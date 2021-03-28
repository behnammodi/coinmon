#!/usr/bin/env node
const fs = require('fs')
const program = require('commander')
const axios = require('axios')
const ora = require('ora')
const Table = require('cli-table3')
const colors = require('colors')
const validation = require('./validation.js')
const constants = require('./constants.js')

const DEFAULT_TOP = 10
const MAX_TOP = 2000

// helper functions
const list = value => value && value.split(',') || []

const getColoredChangeValueText = (value) => {
  const text = `${value}%`
  return value && (value > 0 ? text.green : text.red) || 'NA'
}

const formatNumber = n => {
  if (n < 1e3) return n;
  if (n >= 1e3 && n < 1e6) return +(n / 1e3).toFixed(1) + 'K';
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'M';
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'B';
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + 'T';
}

const getValidTop = (top) => {
  if (Number.isNaN(top) || top < 1) {
    return DEFAULT_TOP
  }
  if (top > MAX_TOP) {
    return MAX_TOP
  }
  return top
}

const { version } = require('../package.json')
program
  .version(version)
  .option('-f, --find [symbol]', 'Find specific coin data with coin symbol (can be a comma seperated list)', list, [])
  .option('-t, --top [index]', 'Show the top coins ranked from 1 - [index] according to the market cap', validation.validateNumber, DEFAULT_TOP)
  .option('-v, --verbose', 'Get more information it is useful for debugging coinmon', null, false)
  .parse(process.argv)

console.log('\n')

const find = program.find
const top = find.length > 0 ? MAX_TOP : getValidTop(program.top)
const verbose = program.verbose || false;

// handle table
const defaultHeader = [
  'Rank',
  'Coin',
  'Price (USD)',
  'Change 24H',
  // 'VWAP 24H',
  'Market Cap',
  'Supply',
  'Volume 24H',
].map(title => title.yellow)
const defaultColumns = defaultHeader.map((item, index) => index)
const columns = defaultColumns
const sortedColumns = columns.sort()
const header = sortedColumns.map(index => defaultHeader[index])
const table = new Table({
  chars: {
    'top': '─',
    'top-mid': '┬',
    'top-left': '┌',
    'top-right': '┐',
    'bottom': '─',
    'bottom-mid': '┴',
    'bottom-left': '└',
    'bottom-right': '┘',
    'left': '│',
    'left-mid': '├',
    'mid': '─',
    'mid-mid': '┼',
    'right': '│',
    'right-mid': '┤',
    'middle': '│'
  },
  head: header
})

// read portfolio config
// let portfolioCoins = []
// let portfolioSum = 0
// if (portfolio) {
//   try {
//     const portfolioPath = (typeof portfolio) === 'string' ? portfolio : constants.portfolioPath
//     portfolioCoins = JSON.parse(fs.readFileSync(portfolioPath).toString())
//   } catch (error) {
//     console.log(`Please include a valid json file.`.red)
//     process.exit()
//   }
// }

// For testing
// console.log('--convert', convert)
// console.log('--find', find)
// console.log('--top', top)
// console.log('--portfolio', portfolio)
// console.log('--specific', columns)

// show loading animation
const spinner = ora('Loading data').start()

// call coinmarketcap API
// const sourceUrl = `https://api.coinmarketcap.com/v1/ticker/?limit=${top}&convert=${convert}`
const sourceUrl = `https://api.coincap.io/v2/assets?limit=${top}`
// const priceKey = `price_${convert}`.toLowerCase()
// const marketCapKey = `market_cap_${marketcapConvert}`.toLowerCase()
// const volume24hKey = `24h_volume_${marketcapConvert}`.toLowerCase()
// const keysMap = {
//   0: 'rank',
//   1: 'symbol',
//   2: priceKey,
//   3: 'percent_change_1h',
//   4: 'percent_change_24h',
//   5: 'percent_change_7d',
//   6: marketCapKey
// }
// if (portfolio) {
//   keysMap[defaultHeader.length - 1] = 'portfolio_balance'
//   keysMap[defaultHeader.length] = 'portfolio_estimated_value'
// }
axios.get(sourceUrl)
  .then((response) => {
    spinner.stop()
    response.data.data
      .filter(record => {
        if (find.length > 0) {
          return find.some(keyword => record.symbol.toLowerCase() === keyword.toLowerCase())
        }
        return true
      })
      .map(record => {
        const editedRecord = {
          name: record.name,
          symbol: record.symbol,
          rank: record.rank ? +record.rank : 0,
          price: record.priceUsd ? +record.priceUsd : 0,
          market_cap: record.marketCapUsd ? +record.marketCap : 0,
          supply: record.supply ? +record.supply : 0,
          market_cap: record.marketCapUsd ? +record.marketCapUsd : 0,
          percent_change_24h: record.changePercent24Hr ? +record.changePercent24Hr : 0,
          volume: record.volumeUsd24Hr ? +record.volumeUsd24Hr : 0,
        }
        return editedRecord
      })
      .map(record => {
        // marketcap
        // const marketCap = record[marketCapKey]
        // const displayedMarketCap = marketCap && humanize.compactInteger(marketCap, 3) || 'NA'
        // final value
        const defaultValues = [
          record.rank,
          record.symbol,
          record.price.toFixed(4),
          getColoredChangeValueText(record.percent_change_24h.toFixed(2)),
          formatNumber(record.market_cap),
          formatNumber(record.supply),
          formatNumber(record.volume),
        ]
        const values = sortedColumns
          .map(index => defaultValues[index])
        return values
      })
      .forEach(record => table.push(record))
    if (table.length === 0) {
      console.log('We are not able to find coins matching your keywords'.red)
    } else {
      console.log(`Data source from coincap.io at ${new Date().toLocaleTimeString()}`)
      console.log(table.toString())
    }
  })
  .catch(function (error) {
    spinner.stop()
    if (verbose) {
      console.log('error', error)
    } else {
      console.error('Coinmon is not working now. Please try again later.'.red)
    }
  })
