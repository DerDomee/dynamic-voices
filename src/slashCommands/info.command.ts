import {
	ApplicationCommandData,
	ApplicationCommandType,
	ChatInputCommandInteraction,
	PermissionsBitField,
	EmbedBuilder,
} from 'discord.js';
import {logger} from '../logger';
import {DDCommand} from './_commands';


export default {
	commandData: {
		type: ApplicationCommandType.ChatInput,
		name: 'info',
		description:
			'View general information and recent statistics for the ' +
			'Dynamic Voices bot',
		dmPermission: false,
		defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
		options: [],
	} as ApplicationCommandData,

	commandExecutor: async (interaction: ChatInputCommandInteraction) => {
		if (interaction.commandName !== 'info') {
			logger.error(
				`Interaction '${interaction.commandName}' got thrown into handler ` +
				'for \'info\'!',
			);
			logger.error(Error().stack);
		}

		await interaction.deferReply({ephemeral: true});

		const infoEmbed = new EmbedBuilder()
			.setColor([1, 1, 1])
			.setTitle('Dynamic Voices bot information')
			.addFields({name: 'Test', value: 'testvalue', inline: true})
			.toJSON();

		await interaction.editReply({embeds: [infoEmbed]});
	},
} as DDCommand;
