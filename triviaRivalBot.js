
const sendAnswer = (quest, socket) => {
    var answerIdx = Math.floor(Math.random() * quest.answers.length)
    var answerId = quest.answers[answerIdx].id

    var delay = (Math.random() * 2000) + 500
    setTimeout(_=> socket.emit('playerAnswer', { answerId, answerTime: delay }), delay)
}

const initiateBot = () => {
    var socket = require('socket.io-client')('http://localhost:3003')

    socket.on('connect', _ => console.log('bot connected. bot socket.id:', socket.id))
    
    socket.emit('joinGameRoom')

    socket.on('firstRound', ({ quest }) => {
        sendAnswer(quest, socket)
    })

    socket.on('nextRound', quest => {
        sendAnswer(quest, socket)
    })

    socket.on('gameCompleted', _=> socket.disconnect())
}




module.exports = initiateBot

