Update user match and tournament statistics

Tracked stats per user per "rules of play":

- Elo rating
- number of matches won
- number of matches played
- number of tournaments won
- number of tournaments played
- total number of coins won (payouts)

Matches are always between 2 players.  Only the winner of a match
earns a payout.

Tournaments are always between 8 players.  The winner of the tournament
finals match wins the tournament.  No other players earn a payout.
Tournament matches that are not finals do have stats updated but do not
have payouts.

## Installation

    npm i --save rpc-user-stats

## Usage

    const Redis = require('ioredis')
    const redis = new Redis(process.env.REDIS_URL)

    const handlers = require('rpc-user-stats')({
      redis,
      tournamentSize: 8,
      defaultElo: 1200
    })

    require('rpc-over-ws')(handlers)

## API

    didWin({ rules, opp, bet, isTourney, isFinals }) -> Promise<{
      rules,
      payout,
      stats: {
        winner: {
          alias,
          stats: {
            matchesPlayed,
            matchesWon,
            tournamentsPlayed,
            tournamentsWon,
            coinsWon,
            eloRating
          },
          eloPrevious,
          balance
        },
        loser: {
          alias,
          stats: {
            matchesPlayed,
            matchesWon,
            tournamentsPlayed,
            tournamentsWon,
            coinsWon,
            eloRating
          },
          eloPrevious,
        },
      }
    }>

    getStats({ alias, rules }) -> Promise<{
      matchesPlayed,
      matchesWon,
      tournamentsPlayed,
      tournamentsWon,
      coinsWon,
      eloRating
    }>
