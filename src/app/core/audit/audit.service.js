'use strict';

const deps = require('../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,
	auditLogger = deps.auditLogger;

// Creates an audit entry persisted to Mongo and the bunyan logger
module.exports.audit = function(message, eventType, eventAction, eventActor, eventObject, eventMetadata, stringifyEventObject) {
	const Audit = dbs.admin.model('Audit');
	const utilService = deps.utilService;

	return Promise.resolve(eventActor).then((actor) => {
		// Extract additional metadata to audit
		const userAgentObj = utilService.getUserAgentFromHeader(eventMetadata);

		// Send to Mongo
		const newAudit = new Audit({
			created: Date.now(),
			message: message,
			audit: {
				auditType: eventType,
				action: eventAction,
				actor: actor,
				userSpec: userAgentObj
			}
		});

		newAudit.audit.object = stringifyEventObject ? JSON.stringify(eventObject) : eventObject;

		// Send to bunyan logger for logfile persistence
		auditLogger.audit(message, eventType, eventAction, actor, eventObject, userAgentObj);

		return newAudit
			.save()
			.catch((err) => {
				// Log and continue the error
				logger.error({err: err, audit: newAudit}, 'Error trying to persist audit record to storage.');
				return Promise.reject(err);
			});
	});
};
