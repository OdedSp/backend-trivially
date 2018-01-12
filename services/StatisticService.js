const cl = console.log

const { dbConnect } = require('../mongo_connect/mongoConnect.js')

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
					else resolve(_aggregatedResults(objs))
					// res.json(stats);
				}
				db.close();
			});
		})
	});
}
function _aggregatedResults(games){
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

module.exports = {
    getGameStatisticsPerUser
}
