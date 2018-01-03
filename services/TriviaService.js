const cl = console.log

const { dbConnect } = require('../mongo_connect/mongoConnect.js')

const gameRooms = []

function getRoom(socketId, user) {
	var room = gameRooms.find(({ players }) => players.length === 1) || _createRoom()
	room.players.push(_createPlayer(socketId, user))
	// room.playersMap[socketId] = _createPlayer(user)
	return room
}

function _createRoom() {
	var room = {
		name: _getRand(5),
		createdAt: Date.now(),
		players: [],
		quests: null,
		answerCounters: [],
		currQuestIdx: 0
	}
	gameRooms.push(room) // maybe use unshift to make finding a room a little more efficient
	return room
}

function _createPlayer(socketId, user) {
	return {
		socketId,
		id: '__mongo_id__', // user._id
		name: '__the_username__', // user.name,
		avatar: '__img_url__',
		answers: []
	}
}

// function checkIfCorrect(answer, quest) {
// 	return answer === quest.correct_answer
// }

// very raw stages
function handleGameOver(room, ev, io) {
	io.in(room.name).emit(ev) // TODO: send some stats
	cl(room.players)
	// cl(`io.sockets.adapter before clients leaving room ${room.name}`, io.sockets.adapter.rooms)
	delete io.sockets.adapter.rooms[room.name]
	// cl(`io.sockets.adapter.rooms after clients leaving room ${room.name}`, io.sockets.adapter.rooms)

	var roomIdx = gameRooms.findIndex(({name}) => name === room.name) // TODO: try to ensure no duplicates in room names
	if (roomIdx !== -1) {
		gameRooms.splice(roomIdx, 1)
		_updateQuestAnswerCounters(room.answerCounters)
	}
}

function getUserQuest(quest) {
	var userQuest = {...quest}
	delete userQuest.correctAnswerId
	return userQuest
}

function createAnswerCounter(questId) {
	return {
		questId,
		correctCount: 0,
		incorrectCount: 0
	}
}

function getQuestionSet(count) {
	return new Promise((resolve, reject) => {
		dbConnect().then(db => {
			const collection = db.collection('quest');
			
			collection.aggregate([{$sample: { size: count }}]).toArray((err, quests) => {
				if (err) {
					reject('Cannot get you a list of ', err)
				} else {
					cl('Returning list of ' + quests.length + ' quests');
					quests.forEach(quest => {
						quest.categoryImg = _getCategoryImgUrl(quest.category)
					})
					resolve(quests);
				}
				db.close();
			});
		});
	})
}

function _updateQuestAnswerCounters(answerCounters) {
	// return new Promise((resolve, reject) => {
	return dbConnect().then(db => {
		const collection = db.collection('quest')
		const writePrms = answerCounters.map(counter => {
			return collection.update({_id: counter.questId},
			{$inc: {
				answeredCorrectlyCount: counter.correctCount,
				answeredIncorrectlyCount: counter.incorrectCount
			}})
		})
		return Promise.all(writePrms)
		.then(writeResults => cl({writeResults}))
	})
	// })
}

function _getRand(size){
	return Math.random().toString(36).substring(2,2+size)
}

function _getCategoryImgUrl(category) {
	var imgUrl = 'http://res.cloudinary.com/koolshooz/image/upload/v1514905599/'
	imgUrl += category.toLowerCase()
					.replace(/\s&\s|\s/g, '-')
					.concat('.jpg')	
	return imgUrl
}

module.exports = {
	getRoom,
	getQuestionSet,
	getUserQuest,
	createAnswerCounter,
    handleGameOver
}