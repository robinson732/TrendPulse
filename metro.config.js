const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const defaultBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [
  ...defaultBlockList,
  new RegExp(`\\.local${require("path").sep === "\\" ? "\\\\" : "/"}state`),
];

module.exports = config;
