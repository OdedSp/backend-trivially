
// Minimal Simple REST API Handler (With MongoDB and Socket.io)
// Plus support for simple login and session
// Plus support for file upload
// Author: Yaron Biton misterBIT.co.il

'use strict';

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

// app.use(express.static('dist')); // use in production

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
app.get('/data/statistic/:userId', function (req, res) {
	cl('Entered GET stats')

	if (req.params.userId) {
		cl('Entered GET stats')
		var query = {userId: req.params.userId}
		getGameStatisticsPerUser(query)
		.then(statObj => {
			cl('Returning user statistics');
			res.json(statObj);
		})
		.catch(error => {
			cl('Cannot get statistics for user', error)
			res.json(404, { error })
		})
	}
	// } else {
	// 	const objType = req.params.objType;
	// 	var query = getBasicQueryObj(req);
	// 	myDbConnect().then(db => {
	// 		const collection = db.collection(objType);
	
	// 		collection.find(query).toArray((err, objs) => {
	// 			if (err) {
	// 				cl('Cannot get you a list of ', err)
	// 				res.json(404, { error: 'not found' })
	// 			} else {
	// 				cl('Returning list of ' + objs.length + ' ' + objType + 's');
	// 				res.json(objs);
	// 			}
	// 			db.close();
	// 		});
	// 	});
	// }
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
	
		const gameStat = req.body;
	
		myDbConnect().then((db) => {
			db.collection('user').findOne(
				{_id: new mongodb.ObjectID(gameStat.userId)},
				function(err,user){
					if (user){
						const collection = db.collection(objType);
						collection.insert(gameStat, (err, result) => {
							if (err) {
								cl(`Couldnt insert a new ${objType}`, err)
								res.json(500, { error: 'Failed to add' })
							} else {
								cl(objType + ' added');
								res.json(gameStat);
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
		

// // GET - a list of game results per user name
// app.get('/data/statistic/:userName', function (req, res){
// 	cl('inside stats per user')
// });


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

		collection.findOne(
			{ $or: [{signup_email: obj.signup_email}, {username: obj.username}] },
			(err, user) => {
				if (user) res.json(412, {error: 'username or email already in the system'})
				else {
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
				}
			})
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
var port = process.env.PORT || 3003;
http.listen(port, function () {
	console.log(`misterREST server is ready at ${baseUrl}`);
	console.log(`GET (list): \t\t ${baseUrl}/{entity}`);
	console.log(`GET (single): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`DELETE: \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`PUT (update): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`POST (add): \t\t ${baseUrl}/{entity}`);

});	
	
const TriviaService = require('./services/TriviaService')

let rivalBot = require('./triviaRivalBot')
let botMode = false

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
			socket.emit('waitingForRival')
			if (botMode) rivalBot()
		} else {
			TriviaService.getQuestionSet(5)
			.then(quests => {
				room.quests = quests // same room pointer in both sockets so this works
				var currQuest = room.quests[room.currQuestIdx]
				room.answerCounters.push(TriviaService.createAnswerCounter(currQuest._id))


				/**** TAKE CARE OF THIS SH */
				var player = room.players.find(({ socketId }) => socketId === socket.id).user
				if (player.username === 'Me') player.username = 'Rival'
				var rival = room.players.find(({ socketId }) => socketId !== socket.id).user
				if (rival.username === 'Me') rival.username = 'Rival'
				
				var userQuest = TriviaService.getUserQuest(currQuest)

 				socket.emit('firstRound', { quest: userQuest, rival, createdAt: room.createdAt })
				socket.in(room.name).emit('firstRound', { quest: userQuest, rival: player, createdAt: room.createdAt })
			})
			.catch(err => cl(err))
		}
	})
	
	socket.on('playerAnswer',({ answerId, answerTime }) => {
		cl('player answerId:', answerId)
		cl('player answerTime:', answerTime)
		answerTime = (answerTime !== null)? Math.floor(answerTime / 500) / 2 : answerTime
		var currQuest = room.quests[room.currQuestIdx]
		var points = 0

		if (answerId === currQuest.correctAnswerId) {
			points = 100 - 4 * answerTime
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
		
		socket.emit('answerProcessed', { answerId, points, answerTime })
		
		socket.in(room.name).emit('rivalAnswer', { answerId, points, answerTime })
		
		if (room.players.every(({ answers }) => answers.length === room.currQuestIdx + 1)) {
			io.in(room.name).emit('answerWas', currQuest.correctAnswerId)
			currQuest = room.quests[++room.currQuestIdx]
			
			setTimeout(_=> {
				if (currQuest) {
					room.answerCounters.push(TriviaService.createAnswerCounter(currQuest._id))
					io.in(room.name).emit('nextRound', TriviaService.getUserQuest(currQuest))
				} else TriviaService.handleGameOver(room, 'gameCompleted', io)
			}, 3000)
		
		}
	})

	socket.on('leftGame', _=> {
		if (room) TriviaService.handleGameOver(room, 'rivalLeft', io)
	})
	
	socket.on('disconnect', _=> {
		cl('user disconnected')
		if (room) TriviaService.handleGameOver(room, 'rivalLeft', io)
	});
});

cl('WebSocket is Ready');

//******************** Functions used in the trivia socket connection ************************//

function getGameStatisticsPerUser(query){
	const objType = 'statistic';
	// var query = {username:req.query.username};
	return myDbConnect().then(db => {
		return new Promise((resolve, reject) => {
			const collection = db.collection(objType);
			collection.find(query).toArray((err, objs) => {
				if (err) {
					reject(err)
					// cl('Cannot get you a list of ', err)
					// res.json(404, { error: 'not found' })
				} else {
					// cl('Returning list of ' + objs.length + ' ' + objType + 's');
					if (objs.length === 0) reject('No stats found for this user ID')
					else resolve(aggregatedResults(objs))
					// res.json(stats);
				}
				db.close();
			});
		})
	});
}
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


//**** in order to save 1020 trivia questions to DB, take the following code out of comment ****//
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

// mockQuests = shuffle(mockQuests)

// function shuffle(a) {
//     for (let i = a.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [a[i], a[j]] = [a[j], a[i]];
//     }
//     return a;
// }

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

// myDbConnect().
// then(db => {
// 	const collection = db.collection('quest');
// 	cl('mockQuests.length', mockQuests.length)
// 	collection.insertMany(mockQuests)
// })


