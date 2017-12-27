
// var currQuest = null

const initiateBot = () => {
    var socket = require('socket.io-client')('http://localhost:3003')

    socket.on('connect', _ => console.log('bot connected. bot socket.id:', socket.id))
    
    socket.emit('joinGameRoom')

    socket.on('nextRound', quest => {
        var answerIdx = Math.floor(Math.random() * quest.answers.length)
        var answer = quest.answers[answerIdx]

        var delay = (Math.random() * 2000) + 500
        setTimeout(_=> socket.emit('playerAnswer', {answer, answerIdx}), delay)
    })

    socket.on('gameCompleted', _=> socket.disconnect())
}




module.exports = initiateBot

