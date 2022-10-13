import fs from 'fs';
import {Collection} from 'discord.js';
import {logger} from './logger';

const findCommandFromArray = (commands: any, cmdName: any): any => {
	let foundElement = null;
	commands.forEach((element: any) => {
		if (element.name == cmdName) foundElement = element;
	});
	return foundElement;
};

export const loadSlashCommands = () => {
	const slashCommands = new Collection();
	const commandFolder = fs.readdirSync('./src/slashCommands');
	for (const commandFile of commandFolder) {
		try {
			if (!commandFile.endsWith('.command.js')) continue;
			logger.verbose(commandFile);
			const command = require(`./slashCommands/${commandFile}`);
			slashCommands.set(command.commandData.name, command);
			logger.verbose(`[SC ${command.commandData.name}] Loaded successfully`);
		} catch (err) {
			logger.warn(`${err.stack}`);
			logger.warn(`[SC ${commandFile}] Loading failed`);
		}
	}
	logger.verbose(`Loaded ${slashCommands.size} commands from source`);
	return slashCommands;
};

export const updateRegisteredCommands = (
	commandManager: any, oldCommands: any, loadedCommands: any,
) => {
	loadedCommands.forEach(async (element: any) => {
		const oldCommand = findCommandFromArray(
			oldCommands, element.commandData.name);
		if (oldCommand === null) {
			logger.verbose(
				`[SC ${element.commandData.name}] Not previously registered. ` +
				`Registering as new command.`);
			await commandManager.create(element.commandData);
		} else {
			logger.debug(
				`[SC ${element.commandData.name}] Found registered command.`);
			await commandManager.edit(oldCommand.id, element.commandData);
		}
	});
};
