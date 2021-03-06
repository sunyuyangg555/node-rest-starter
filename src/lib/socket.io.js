'use strict';

const
	cookieParser = require('cookie-parser'),
	http = require('http'),
	passport = require('passport'),
	socketio = require('socket.io'),
	expressSession = require('express-session'),
	MongoStore = require('connect-mongo')(expressSession),

	config = require('../config'),
	logger = require('./bunyan.js').logger;

/**
 * Controllers created outside of this class will register
 * themselves as socket listeners, with function definitions
 * stored here.
 */
const registeredSocketListeners = [];

// Give each socket connection its own variable scope
function onConnect(socket) {
	logger.debug('SocketIO: New client connection');

	/**
	 * Setup Socket Event Handlers
	 */
	registeredSocketListeners.forEach((S) => {
		new S({ socket: socket });
	});
}

// Define the Socket.io configuration method
module.exports = (app, db) => {

	// Create a new HTTP server
	logger.info('Creating HTTP Server');
	const server = http.createServer(app);

	// Create a new Socket.io server
	logger.info('Creating SocketIO Server');
	const io = socketio.listen(server);

	// Create a MongoDB storage object
	const mongoStore = new MongoStore({
		mongooseConnection: db.connection,
		collection: config.auth.sessionCollection
	});

	// Intercept Socket.io's handshake request
	io.use((socket, next) => {
		// Use the 'cookie-parser' module to parse the request cookies
		cookieParser(config.auth.sessionSecret)(socket.request, {}, () => {
			// Get the session id from the request cookies
			const sessionId = socket.request.signedCookies['connect.sid'];

			// Use the mongoStorage instance to get the Express session information
			mongoStore.get(sessionId, (err, session) => {
				// Set the Socket.io session information
				socket.request.session = session;

				// Use Passport to populate the user details
				passport.initialize()(socket.request, {}, () => {
					passport.session()(socket.request, {}, () => {
						if (socket.request.user) {
							logger.debug('SocketIO: New authenticated user: %s', socket.request.user.username);
							return next(null, true);
						}
						logger.info('SocketIO: Unauthenticated user attempting to connect.');
						return next(new Error('User is not authenticated'), false);
					});
				});
			});
		});
	});

	// Add an event listener to the 'connection' event
	io.on('connection', onConnect);

	return server;
};

/*
 * App-specific function to register controllers that will be
 * sent the socket
 */
module.exports.registerSocketListener = (s) => {
	let name = s;
	if (null != s.prototype.name) {
		name = s.prototype.name;
	}

	logger.info('Registering Socket Listener: %s', name);
	registeredSocketListeners.push(s);
};
