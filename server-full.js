
// Minimal Simple REST API Handler (With MongoDB and Socket.io)
// Plus support for simple login and session
// Plus support for file upload
// Author: Yaron Biton misterBIT.co.il

'use strict';

// var  mockQuests = require('./mockData.json')

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
console.log(myDbConnect)



// dbConnect().
// then(db => {
// 	const collection = db.collection('quest');
// 	collection.insertMany(mockQuests)
// })


var objTypeRequiresUser = {
	quest: true,
	statistic: true
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
app.post('/data/:objType', upload.single('file'), function (req, res) {
	//console.log('req.file', req.file);
	// console.log('req.body', req.body);

	const objType = req.params.objType;
	cl('POST for ' + objType);

	const obj = req.body;
	cl('body>>> ', obj)
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
	var lastLogin = new Date().toUTCString()
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


const gameRooms = []


io.on('connection', function (socket) {
	var room = null
	socket.on('joinGameRoom', _ => {
		room = getRoom()
		console.log(room)
		socket.join(room.name)
		if (room.connections === 1) socket.emit('waitingForOpponent')
		else {
			getQuestionSet()
			.then(quests => {
				room.quests = quests.slice(0, 10)
				io.in(room.name).emit('startGame', room)	
			})
			.catch(err => console.log(err))
		}
	})

	socket.on('userAnswer',(answer) =>{
		socket.emit('processedAnswer',processedAnswerResult(room,answer)) //sending the calculated points back to the client who sent the answer, and only to him
		answer.rivalPoints = processedAnswerResult(room,answer) 
		socket.in(room.name).emit('rivalAnswer',answer) //sending the answer to the user's rival, and only to him
	})
	


	// var randUserName = getRand(5)
	console.log('a user connected');
	socket.on('disconnect', function () {
		console.log('user disconnected')
		// io.in(room.name).emit('opponentLeft')
	});
});


// gets a set of questions
function getQuestionSet (){
	var collectionName = 'quest'
	var query = {}
	return new Promise((resolve, reject) => {
		myDbConnect().then(db => {
			const collection = db.collection(collectionName);
	
			collection.find(query).toArray((err, objs) => {
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

function getGameStatisticsPerUser(req, res){
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
				res.json(objs);
			}
			db.close();
		});
	});
}


cl('WebSocket is Ready');

function getRand(size){
	return Math.random().toString(36).substring(2,2+size)
}

function getRoom() {
	var room = gameRooms.find(({connections}) => connections === 1) || createRoom()
	room.connections++
	return room
}

function createRoom() {
	var room = {
		name: getRand(5),
		connections: 0
	}
	gameRooms.push(room)
	return room
}

function processedAnswerResult(room,answer){
	var question = room.quests.find(question => question._id == answer.questionId)
	return ((question.correct_answer == answer.selectedAnswer)*100)
}

