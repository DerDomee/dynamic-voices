import {ApplicationCommandData, Interaction} from 'discord.js';
import settingsCommand from './settings.command';
import voiceCommand from './voice.command';

export interface DDCommand {
	commandData: ApplicationCommandData;
	commandExecutor: (interaction: Interaction) => any;
}


export default [
	voiceCommand,
	settingsCommand,
] as DDCommand[];
