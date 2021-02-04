CREATE TABLE `discord_fandom_mapping` (
    `discord_id` BIGINT(64) UNSIGNED NOT NULL,
    `fandom_id` INT(11) NOT NULL,
    PRIMARY KEY(`discord_id`, `fandom_id`)
);
