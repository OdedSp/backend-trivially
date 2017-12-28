// import { forEachOf } from '../../../../Users/Sidney/AppData/Local/Microsoft/TypeScript/2.6/node_modules/@types/async';

// Minimal Simple REST API Handler (With MongoDB and Socket.io)
// Plus support for simple login and session
// Plus support for file upload
// Author: Yaron Biton misterBIT.co.il

'use strict';

// var  mockQuests = require('./mockData.json')

var cl = console.log;

const express = require('express'),
	bodyParser = require('body-parser'),
	cors = require('cors'),
	mongodb = require('mongodb')

const clientSessions = require('client-sessions');
const upload = require('./uploads');
const app = express();

const addRoutes = require('./routes');
addRoutes(app);

var corsOptions = {
	origin: /http:\/\/localhost:\d+/,
	credentials: true
};

const serverRoot = 'http://localhost:3003/';
const baseUrl = serverRoot + 'data';

// app.use(express.static('uploads'));

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(clientSessions({
	cookieName: 'session',
	secret: 'C0d1ng 1s fun 1f y0u kn0w h0w', // set this to a long random string!
	duration: 30 * 60 * 1000,
	activeDuration: 5 * 60 * 1000,
}));

const http = require('http').Server(app);
const io = require('socket.io')(http);


function dbConnect() {

	return new Promise((resolve, reject) => {
		// Connection URL
		var url = 'mongodb://localhost:27017/trivue';
		// Use connect method to connect to the Server
		mongodb.MongoClient.connect(url, function (err, db) {
			if (err) {
				cl('Cannot connect to DB', err)
				reject(err);
			}
			else {
				//cl('Connected to DB');
				resolve(db);
			}
		});
	});
}

// dbConnect().
// then(db => {
// 	const collection = db.collection('quest');
// 	collection.insertMany(mockQuests)
// })


var objTypeRequiresUser = {
	// quest: true
}
// This function is called by all REST end-points to take care
// setting the basic mongo query:
// 1. _id if needed
// 2. userId when needed
function getBasicQueryObj(req) {
	const objType 	= req.params.objType;
	const objId 	= req.params.id;
	var query = {};
	
	if (objId) {
		try { query._id = new mongodb.ObjectID(objId);}
		catch(e) {return query}
	}
	if (!objTypeRequiresUser[objType]) return query;
	query.userId = null;
	if ( req.session.user ) query.userId = req.session.user._id
	return query;
}

// GETs a list
app.get('/data/:objType', function (req, res) {
	const objType = req.params.objType;
	var query = getBasicQueryObj(req);
	dbConnect().then(db => {
		const collection = db.collection(objType);

		collection.find(query).toArray((err, objs) => {
			if (err) {
				cl('Cannot get you a list of ', err)
				res.json(404, { error: 'not found' })
			} else {
				cl('Returning list of ' + objs.length + ' ' + objType + 's');
				res.json(objs);
			}
			db.close();
		});
	});
});

// GETs a single
app.get('/data/:objType/:id', function (req, res) {
	const objType = req.params.objType;
	const objId = req.params.id;
	cl(`Getting you an ${objType} with id: ${objId}`);
	var query = getBasicQueryObj(req)
	dbConnect()
		.then(db=> {
			const collection = db.collection(objType);
			
			return collection.findOne(query)
				.then(obj => {
					cl('Returning a single ' + objType);
					res.json(obj);
					db.close();	
				})
				.catch(err => {
					cl('Cannot get you that ', err)
					res.json(404, { error: 'not found' })
					db.close();	
				})

		});
});

// DELETE
app.delete('/data/:objType/:id', function (req, res) {
	const objType 	= req.params.objType;
	const objId 	= req.params.id;
	cl(`Requested to DELETE the ${objType} with id: ${objId}`);
	var query = getBasicQueryObj(req);
	
	dbConnect().then((db) => {
		const collection = db.collection(objType);
		collection.deleteOne(query, (err, result) => {
			if (err) {
				cl('Cannot Delete', err)
				res.json(500, { error: 'Delete failed' })
			} else {
				if (result.deletedCount)	res.json({});
				else res.json(403, { error: 'Cannot delete' }) 
			}
			db.close();
		});

	});
});

// POST - adds 
app.post('/data/:objType', upload.single('file'), function (req, res) {
	//console.log('req.file', req.file);
	// console.log('req.body', req.body);

	const objType = req.params.objType;
	cl('POST for ' + objType);

	const obj = req.body;
	delete obj._id;
	if (objTypeRequiresUser[objType]){
		if (req.session.user) {
			obj.userId = req.session.user._id;
		} else {
			res.json(403, { error: 'Please Login first' })
			return;
		}
	} 
	// If there is a file upload, add the url to the obj
	// if (req.file) {
	// 	obj.imgUrl = serverRoot + req.file.filename;
	// }



	dbConnect().then((db) => {
		const collection = db.collection(objType);

		collection.insert(obj, (err, result) => {
			if (err) {
				cl(`Couldnt insert a new ${objType}`, err)
				res.json(500, { error: 'Failed to add' })
			} else {
				cl(objType + ' added');
				res.json(obj);
			}
			db.close();
		});
	});

});

// PUT - updates
app.put('/data/:objType/:id', function (req, res) {
	const objType 	= req.params.objType;
	const objId 	= req.params.id;
	const newObj 	= req.body;

	cl(`Requested to UPDATE the ${objType} with id: ${objId}`);
	var query = getBasicQueryObj(req)
	
	dbConnect().then((db) => {
		const collection = db.collection(objType);
		collection.updateOne(query, newObj,
			(err, result) => {
				if (err) {
					cl('Cannot Update', err)
					res.json(500, { error: 'Update failed' })
				} else {
					if (result.modifiedCount) res.json(newObj);
					else res.json(403, { error: 'Cannot update' })
				}
				db.close();
			});
	});
});

// Basic Login/Logout/Protected assets
app.post('/login', function (req, res) {
	dbConnect().then((db) => {
		db.collection('user').findOne({ username: req.body.username, pass: req.body.pass }, function (err, user) {
			if (user) {
				cl('Login Succesful');
				delete user.pass;
				req.session.user = user;  
				res.json({ token: 'Beareloginr: puk115th@b@5t', user });
			} else {
				cl('Login NOT Succesful');
				req.session.user = null;
				res.json(403, { error: 'Login failed' })
			}
		});
	});
});

app.get('/logout', function (req, res) {
	req.session.reset();
	res.end('Loggedout');
});

function requireLogin(req, res, next) {
	if (!req.session.user) {
		cl('Login Required');
		res.json(403, { error: 'Please Login' })
	} else {
		next();
	}
}

app.get('/protected', requireLogin, function (req, res) {
	res.end('User is loggedin, return some data');
});


// Kickup our server 
// Note: app.listen will not work with cors and the socket
// app.listen(3003, function () {
http.listen(3003, function () {
	console.log(`misterREST server is ready at ${baseUrl}`);
	console.log(`GET (list): \t\t ${baseUrl}/{entity}`);
	console.log(`GET (single): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`DELETE: \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`PUT (update): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`POST (add): \t\t ${baseUrl}/{entity}`);

});


const gameRooms = []

let botMode = true

io.on('connection', function (socket) {
	var room = null
	var currQuest = {
		quest: null,
		answerCount: 0
	}
	// var rivalId = null
	socket.on('joinGameRoom', _ => {
		room = getRoom()
		cl(room)
		socket.join(room.name)
		room.players[socket.id] = getEmptyPlayerStats()
		if (room.connections === 1) {
			socket.emit('waitingForOpponent')
			if (botMode) require('./triviaRivalBot')()
		}
		else {
			getQuestionSet(5)
			.then(quests => {
				// cl(quests)
				room.quests = quests
				room.clientQuests = getClientQuests(quests)
				// var questsForUser = getUserQuests(quests)
				// io.in(room.name).emit('startGame', {room: room.name, quests: questsForUser})
				io.in(room.name).emit('nextRound', room.clientQuests[room.currTurn.questIdx])
			})
			.catch(err => console.log(err))
		}
	})

	socket.on('playerAnswer',(answer) => {
		cl('player answered:', answer)
		var correct = checkIfCorrect(answer.answer, room.quests[room.currTurn.questIdx])
		var playerStats = room.players[socket.id]
		var points = 0
		if (correct) points = 100
		playerStats.currQuestPts = points
		playerStats.totalPts += points
		
		socket.emit('answerProcessed', { answerIdx: answer.answerIdx, points })

		socket.in(room.name).emit('rivalAnswer', { answerIdx: answer.answerIdx, points })

		if (++room.currTurn.answerCount === room.connections) {
			var questIdx = ++room.currTurn.questIdx
			room.currTurn.answerCount = 0
			setTimeout(_=> {
				room.quests.length !== questIdx
				? io.in(room.name).emit('nextRound', room.clientQuests[questIdx])
				// : io.in(room.name).emit('gameCompleted') // TODO: write handleGameOver()
				: handleGameOver(room)
			}, 3000)
		}
	})
	


	// var randUserName = getRand(5)
	console.log('a user connected');
	socket.on('disconnect', function () {
		console.log('user disconnected')
		// io.in(room.name).emit('opponentLeft')
	});
});

cl('WebSocket is Ready');

//******************** Functions used in the trivia socket connection ************************//

// gets a set of questions
function getQuestionSet(count) {
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

// TODO: perhaps use index of question instead of finding by id (TODONE for now)
function checkIfCorrect(answer, quest) {
	return answer === quest.correct_answer
}

// very raw stages
function handleGameOver(room) {
	io.in(room.name).emit('gameCompleted') // TODO: send some stats
	cl(room.players)
	cl(`io.sockets.adapter before clients leaving room ${room.name}`, io.sockets.adapter.rooms)
	delete io.sockets.adapter.rooms[room.name]
	cl(`io.sockets.adapter.rooms after clients leaving room ${room.name}`, io.sockets.adapter.rooms)

	var roomIdx = gameRooms.findIndex(({name}) => name === room.name) // TODO: try to ensure no duplicates in room names
	gameRooms.splice(roomIdx, 1)
}

function getClientQuests(quests) {
	return quests.map(quest => ({
		_id: quest._id,
		quest: quest.question,
		answers: getShuffledAnswers(quest),
		category: quest.category,
		type: quest.type
	}))
}

function getShuffledAnswers(quest) {
	var answers = [];
	for (let i = 0; i < quest.incorrect_answers.length; i++) {
	  answers.push(quest.incorrect_answers[i]);
	}
	answers.push(quest.correct_answer);
	
	for (let i = answers.length - 1; i > 0; i--) {
	  let j = Math.floor(Math.random() * (i + 1));
	  [answers[i], answers[j]] = [answers[j], answers[i]];
	}
	return answers
  }

function getRoom() {
	var room = gameRooms.find(({connections}) => connections === 1) || createRoom()
	room.connections++
	return room
}

function createRoom() {
	var room = {
		name: getRand(5),
		connections: 0,
		players: {},
		currTurn: {
			questIdx: 0,
			answerCount: 0
		}
	}
	gameRooms.push(room)
	return room
}

function getEmptyPlayerStats() {
	return {
		answeredCurrQuest: false,
		currQuestPts: 0,
		totalPts: 0,
		correctAnswers: 0
	}
}

function getRand(size){
	return Math.random().toString(36).substring(2,2+size)
}
