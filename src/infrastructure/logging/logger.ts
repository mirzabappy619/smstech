/**
 * Simple Logger
 * Provides structured logging for the application
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogData {
	[key: string]: any;
}

class Logger {
	private log(level: LogLevel, message: string, data?: LogData) {
		const timestamp = new Date().toISOString();

		if (level === "error") {
			console.error(`[${timestamp}] ERROR:`, message, data || "");
		} else if (level === "warn") {
			console.warn(`[${timestamp}] WARN:`, message, data || "");
		} else if (level === "debug") {
			console.debug(`[${timestamp}] DEBUG:`, message, data || "");
		} else {
			console.log(`[${timestamp}] INFO:`, message, data || "");
		}
	}

	info(message: string, data?: LogData) {
		this.log("info", message, data);
	}

	warn(message: string, data?: LogData) {
		this.log("warn", message, data);
	}

	error(message: string, data?: LogData) {
		this.log("error", message, data);
	}

	debug(message: string, data?: LogData) {
		this.log("debug", message, data);
	}
}

export const logger = new Logger();
