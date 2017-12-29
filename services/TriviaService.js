const cl = console.log

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
function handleGameOver(room, io, dbConnect) {
	io.in(room.name).emit('gameCompleted') // TODO: send some stats
	cl(room.players)
	cl(`io.sockets.adapter before clients leaving room ${room.name}`, io.sockets.adapter.rooms)
	delete io.sockets.adapter.rooms[room.name]
	cl(`io.sockets.adapter.rooms after clients leaving room ${room.name}`, io.sockets.adapter.rooms)

	var roomIdx = gameRooms.findIndex(({name}) => name === room.name) // TODO: try to ensure no duplicates in room names
	gameRooms.splice(roomIdx, 1)

	_updateQuestAnswerCounters(room.answerCounters, dbConnect)
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

function getQuestionSet(count, dbConnect) {
	var collectionName = 'quest'
	// var query = {}
	return new Promise((resolve, reject) => {
		dbConnect().then(db => {
			const collection = db.collection(collectionName);
			
			collection.aggregate([{$sample: { size: count }}]).toArray((err, objs) => {
				if (err) {
					reject('Cannot get you a list of ', err)
				} else {
					cl('Returning list of ' + objs.length + ' ' + collectionName + 's');
					resolve(objs);
				}
				db.close();
			});
		});
	})
}

function _updateQuestAnswerCounters(answerCounters, dbConnect) {
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

// // TODO: get rid of this
// function getClientQuests(quests) {
// 	return quests.map(quest => ({
// 		_id: quest._id,
// 		quest: quest.question,
// 		answers: getShuffledAnswers(quest),
// 		category: quest.category,
// 		type: quest.type
// 	}))
// }

// function getShuffledAnswers(quest) {
// 	var answers = [];
// 	for (let i = 0; i < quest.incorrect_answers.length; i++) {
// 	  answers.push(quest.incorrect_answers[i]);
// 	}
// 	answers.push(quest.correct_answer);
	
// 	for (let i = answers.length - 1; i > 0; i--) {
// 	  let j = Math.floor(Math.random() * (i + 1));
// 	  [answers[i], answers[j]] = [answers[j], answers[i]];
// 	}
// 	return answers
//   }



// function getEmptyPlayerStats() {
// 	return {
// 		answeredCurrQuest: false,
// 		currQuestPts: 0,
// 		totalPts: 0,
// 		correctAnswers: 0
// 	}
// }

function _getRand(size){
	return Math.random().toString(36).substring(2,2+size)
}

module.exports = {
	getRoom,
	getQuestionSet,
	getUserQuest,
	createAnswerCounter,
    handleGameOver
}