
// Minimal Simple REST API Handler (With MongoDB and Socket.io)
// Plus support for simple login and session
// Plus support for file upload
// Author: Yaron Biton misterBIT.co.il

'use strict';

var cl = console.log;

const express = require('express'),
	bodyParser = require('body-parser'),
	cors = require('cors')
	// mongodb = require('mongodb')

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

var myDbConnect = require('./mongo_connect/mongoConnect.js').dbConnect





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
//first, we check if a username was sent, if so we go on to getting game stats
app.get('/data/:objType', function (req, res) {
	if (req.query.username) {
		getGameStatisticsPerUser(req, res)
	} else {
		const objType = req.params.objType;
		var query = getBasicQueryObj(req);
		myDbConnect().then(db => {
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
	}
});

// GETs a single
app.get('/data/:objType/:id', function (req, res) {
	const objType = req.params.objType;
	const objId = req.params.id;
	cl(`Getting you an ${objType} with id: ${objId}`);
	var query = getBasicQueryObj(req)
	myDbConnect()
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
	
	myDbConnect().then((db) => {
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

// POST - adds game statistic
// upload.single('file') was removed
app.post('/data/statistic', function (req, res) {
	
		const objType = 'statistic';
		cl('POST for ' + objType);
	
		const obj = req.body;
	
		myDbConnect().then((db) => {
			db.collection('user').findOne(
				{username:obj.username},
				function(err,user){
					if (user){
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
					} else {
						cl('could not find this user - statistic not updated')
						res.json(500, { error: 'could not find this user - statistic not updated' })					
					}
				}
			);
		});
	
	});
		

// GET - a list of game results per user name
app.get('/data/statistic/:userName', function (req, res){
	cl('inside stats per user')
});


// POST - adds 
app.post('/data/user', upload.single('file'), function (req, res) {
	//console.log('req.file', req.file);
	// console.log('req.body', req.body);

	const objType = 'user';
	cl('POST for ' + objType);

	const obj = req.body;
	delete obj._id;
	// if (objTypeRequiresUser[objType]){
	// 	if (req.session.user) {
	// 		obj.userId = req.session.user._id;
	// 	} else {
	// 		res.json(403, { error: 'Please Login first' })
	// 		return;
	// 	}
	// } 
	// If there is a file upload, add the url to the obj
	// if (req.file) {
	// 	obj.imgUrl = serverRoot + req.file.filename;
	// }



	myDbConnect().then((db) => {
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
	
	myDbConnect.then((db) => {
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
	var lastLogin = Date.now()
	myDbConnect().then((db) => {
		db.collection('user').findOneAndUpdate(
			{ username: req.body.username, pass: req.body.pass },
			{ $set:  {"last_login" : lastLogin}},
				function (err, user) {
					if (user) {
						cl('Login Succesful');
						delete user.pass;
						delete user.lastErrorObject;
						delete user.ok;
						req.session.user = user;  
						res.json({ message: 'login successful', user });
					} else {
						cl('Login NOT Succesful');
						req.session.user = null;
						res.json(403, { error: 'Login failed' })
					}
				}
			);
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
	
const TriviaService = require('./services/TriviaService')

let botMode = true

io.on('connection', function (socket) {
	cl('a user connected');
	var room = null

	socket.on('joinGameRoom', (user) => {
		// TriviaService.getRoom(socket.id, user)
		// .then(res => {
		// 	room = res
		// })
		room = TriviaService.getRoom(socket.id, user)
		cl({room})
		socket.join(room.name)
		if (room.players.length === 1) {
			socket.emit('waitingForOpponent')
			if (botMode) require('./triviaRivalBot')()
		} else {
			TriviaService.getQuestionSet(5)
			.then(quests => {
				room.quests = quests // same room pointer in both sockets so this works
				var currQuest = room.quests[room.currQuestIdx]
				room.answerCounters.push(TriviaService.createAnswerCounter(currQuest._id))

				var player = room.players.find(({ socketId }) => socketId === socket.id)
				var rival = room.players.find(({ socketId }) => socketId !== socket.id)
				var userQuest = TriviaService.getUserQuest(currQuest)
				
				socket.emit('firstRound', { quest: userQuest, rival })
				socket.in(room.name).emit('firstRound', { quest: userQuest, player })
			})
			.catch(err => cl(err))
		}
	})
	
	socket.on('playerAnswer',({ answerId, answerTime }) => {
		cl('player answerId:', answerId)
		cl('player answerTime:', answerTime)
		var currQuest = room.quests[room.currQuestIdx]
		var points = 0

		if (answerId === currQuest.correctAnswerId) {
			points = 100 - 2 * Math.floor(answerTime / 500)
			points = Math.max(points, 10)
			room.answerCounters[room.currQuestIdx].correctCount++
		} else room.answerCounters[room.currQuestIdx].incorrectCount++

		room.players.find(({ socketId }) => socketId === socket.id)
		.answers.push({
			questId: currQuest._id, // (.toString()?)
			points,
			answerTime,
			answerId
		})
		
		socket.emit('answerProcessed', points)
		
		socket.in(room.name).emit('rivalAnswer', { answerId, points })
		
		if (room.players.every(({ answers }) => answers.length === room.currQuestIdx + 1)) {
			io.in(room.name).emit('answerWas', currQuest.correctAnswerId)
			currQuest = room.quests[++room.currQuestIdx]
			
			setTimeout(_=> {
				if (currQuest) {
					room.answerCounters.push(TriviaService.createAnswerCounter(currQuest._id))
					io.in(room.name).emit('nextRound', TriviaService.getUserQuest(currQuest))
				} else TriviaService.handleGameOver(room, io)
			}, 3000)
		
		}
	})
	
	socket.on('disconnect', function () {
		cl('user disconnected')
		// io.in(room.name).emit('rivalLeft')
		// TriviaService.handleGameOver(room, io, dbConnect)
	});
});

cl('WebSocket is Ready');

//******************** Functions used in the trivia socket connection ************************//

function ggetGameStatisticsPerUser(req, res){
	const objType = 'statistic';
	var query = {username:req.query.username};
	myDbConnect().then(db => {
		const collection = db.collection(objType);

		collection.find(query).toArray((err, objs) => {
			if (err) {
				cl('Cannot get you a list of ', err)
				res.json(404, { error: 'not found' })
			} else {
				cl('Returning list of ' + objs.length + ' ' + objType + 's');
				var stats = aggregatedResults(objs)
				res.json(stats);
			}
			db.close();
		});
	});
}

// gets a set of questions
// function aggregateStats(req, res){
// 	const objType = 'statistic';
// 	var query = {username:req.query.username};
// 	myDbConnect().then(db => {
// 		const collection = db.collection(objType);

// 		collection.find(query).toArray((err, objs) => {
// 			if (err) {
// 				cl('Cannot get you a list of ', err)
// 				res.json(404, { error: 'not found' })
// 			} else {
// 				cl('Returning list of ' + objs.length + ' ' + objType + 's');
// 				res.json(aggregatedResults(objs));
// 			}
// 			db.close();
// 		});
// 	});
// }

function aggregatedResults(games){
	let gamesWon = 0,
		totalQuestions = 0,
		correctAnswers = 0
	for (var game of games){
		if (game.game_results.win === true) {
			gamesWon++
		}
		totalQuestions += game.game_results.total_questions
		correctAnswers += game.game_results.correct_questions
		
	}
	return {
		totalGames: games.length, 
		gamesWon : gamesWon, 
		totalQuestions: totalQuestions, 
		correctAnswers: correctAnswers
		}
}
// function getQuestionSet(count) {
// 	var collectionName = 'quest'
// 	// var query = {}
// 	return new Promise((resolve, reject) => {
// 		dbConnect().then(db => {
// 			const collection = db.collection(collectionName);
			
// 			collection.aggregate([{$sample: { size: count }}]).toArray((err, objs) => {
// 				if (err) {
// 					reject('Cannot get you a list of ', err)
// 				} else {
// 					cl('Returning list of ' + objs.length + ' ' + collectionName + 's');
// 					resolve(objs);
// 				}
// 				db.close();
// 			});
// 		});
// 	})
// }

// function updateQuestAnswerCounters(answerCounters) {
// 	return new promise((resolve, reject) => {
// 		db.connect().then(db => {
// 			const collection = db.collection('quest')
// 			answerCounters.forEach(counter => {
// 				let writeRes = collection.update({_id: conter.questId},
// 				{$inc: {
// 					answeredCorrectlyCount: counter.correctCount,
// 					answeredIncorrectlyCount: counter.incorrectCount
// 				}})
// 				cl({writeRes})
// 			})
// 		})
// 	})
// }


//**** in order to save 1200 trivia questions to DB, take the following code out of comment ****//
//**** (use 'node server-full', not 'nodemon', to ensure DB does not save duplicate documents) ****/

// var mockQuests = require('./mockData.json')
// cl('quests.length:', mockQuests.length)
// mockQuests = mockQuests.map(quest => ({
// 	txt: quest.question,
// 	category: quest.category,
// 	type: quest.type,
// 	difficulty: quest.difficulty,
// 	...getAnswersData(quest),
// 	answeredCorrectlyCount: 0,
// 	answeredIncorrectlyCount: 0
// }))
// cl('quests.length:', mockQuests.length)

// function getAnswersData(quest) {
// 	var answers = []
// 	var ids = Array.from({length: 100}, (ud, i) => i + 1)
	
// 	var correctAnswerId = ids.splice(getRandNum(ids.length), 1)[0]
// 	answers.push({
// 		txt: quest.correct_answer,
// 		id: correctAnswerId
// 	})
	
// 	quest.incorrect_answers.forEach(answer => {
// 		answers.push({
// 			txt: answer,
// 			id: ids.splice(getRandNum(ids.length), 1)[0]
// 		})
// 	})

// 	answers.sort((a, b) => a.id - b.id)

// 	return {
// 		correctAnswerId,
// 		answers
// 	}
// }

// function getRandNum(max) {
// 	return Math.floor(Math.random() * max)
// }

// dbConnect().
// then(db => {
// 	const collection = db.collection('quest');
// 	cl('mockQuests.length', mockQuests.length)
// 	collection.insertMany(mockQuests)
// })