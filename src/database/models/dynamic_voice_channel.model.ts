import {
	AllowNull,
	Column,
	DataType,
	Default,
	Model,
	PrimaryKey,
	Table} from 'sequelize-typescript';

@Table
/**
	*
	*/
export default class DynamicVoiceChannel extends Model {
	@PrimaryKey
	@AllowNull(false)
	@Column({
		type: DataType.STRING(64)})
		guild_snowflake: string;

	@PrimaryKey
	@AllowNull(false)
	@Column({
		type: DataType.STRING(64)})
		voice_channel_snowflake: string;

	@AllowNull(false)
	@Column({
		type: DataType.STRING(64)})
		text_channel_snowflake: string;

	@AllowNull(false)
	@Column({
		type: DataType.STRING(64)})
		positive_accessrole_snowflake: string;

	@AllowNull(true)
	@Column({
		type: DataType.STRING(64)})
		negative_accessrole_snowflake: string;

	@AllowNull(false)
	@Column({
		type: DataType.STRING(64)})
		owner_member_snowflake: string;

	@AllowNull(false)
	@Default(false)
	@Column({
		type: DataType.BOOLEAN})
		is_channel_private: boolean;

	@AllowNull(false)
	@Default(false)
	@Column({
		type: DataType.BOOLEAN})
		is_channel_renamed: boolean;


	@AllowNull(true)
	@Default(null)
	@Column({
		type: DataType.DATE})
		last_edit: Date;

	@AllowNull(false)
	@Default(false)
	@Column({
		type: DataType.BOOLEAN})
		should_archive: boolean;

	@AllowNull(false)
	@Default(false)
	@Column({
		type: DataType.BOOLEAN})
		inviteall_activated: boolean;
}
