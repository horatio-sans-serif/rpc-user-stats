const _ = require('lodash')
const elo = require('elo-rank')()
const normalize = require('normalize-user-alias')
const EventEmitter = require('events')

// NB: clientId === normalized user alias

function statsKey(clientId, rules) {
  return `users/${clientId}/${rules}`
}

function getStats(clientId, rules) {
  return redis.hgetall(statsKey(clientId, rules))
}

function getEloRating(key) {
  return redis.hget(key, 'eloRating').then(val => parseInt(val, 10))
}

module.exports = function ({ redis, defaultElo, tournamentSize }) {
  const emitter = new EventEmitter()

  return {
    getUserStats: ({ alias, rules }) => getStats(normalize(alias), rules),

    didWin: function ({ rules, opp, bet, isTourney, isFinals }) {
      if (!this.clientId)
        return Promise.reject('authentication required')

      rules = normalize(rules || '')

      const oppNorm = normalize(opp || '')
      if (oppNorm === this.clientId)
        return Promise.reject('invalid opponent')

      bet = parseInt(bet, 10) || 0
      if (bet <= 0)
        return Promise.reject('invalid bet')

      isTourney = !!isTourney
      isFinals = !!isFinals

      const winnerStatsKey = statsKey(this.clientId, rules)
      const loserStatsKey = statsKey(oppNorm, rules)

      return Promise.all([
        getEloRating(winnerStatsKey),
        getEloRating(loserStatsKey)
      ])
      .then(ratings => {
        const winnerElo = ratings[0][1] || defaultElo || 1200
        const loserElo  = ratings[1][1] || defaultElo || 1200

        const newWinnerElo = elo.updateRating(elo.getExpected(winnerElo, loserElo), 1, winnerElo)
        const newLoserElo  = elo.updateRating(elo.getExpected(loserElo, winnerElo), 0, loserElo)

        const pipe = redis.pipeline()
        pipe.hincrby(winnerStatsKey, 'matchesPlayed')            // 0
        pipe.hincrby(winnerStatsKey, 'matchesWon')               // 1
        pipe.hincrby(loserStatsKey, 'matchesPlayed')             // 2

        var payout = 0
        if (args.isFinals) {
          pipe.hincrby(winnerStatsKey, 'tournamentsWon', 1)      // 3
          payout = args.bet * (options.tournamentSize || 8)
        } else if (!isTourney) {
          pipe.hincrby(winnerStatsKey, 'tournamentsWon', 0)      // 3; NB: 0
          payout = args.bet * 2
        }

        pipe.hincrby(winnerStatsKey, 'coinsWon', payout)         // 4
        pipe.hincrby(`users/${this.clientId}`, 'coins', payout)  // 5

        pipe.hgetall(winnerStatsKey)                             // 6
        pipe.hgetall(loserStatsKey)                              // 7

        pipe.exec()
        .then(results => {
          _.each([6,7], index => {
            _.each(_.keys(results[index]), key => {
              results[index][key] = parseInt(results[index][key], 10)
            })
          })

          const ret = {
            rules,
            payout,
            stats: {
              winner: {
                stats: results[6],
                eloPrevious: winnerElo,
                balance: +results[5]
              },
              loser: {
                alias: opp,
                stats: results[7],
                eloPrevious: loserElo,
              }
            }
          }

          emitter.emit('match-ended', ret)
          return ret
        })
      })
    },

    emitter
  }
}
