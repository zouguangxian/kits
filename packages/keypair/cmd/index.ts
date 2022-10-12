#!/usr/bin/env -S npx ts-node
import * as commander from 'commander'

const command = new commander.Command()
command
    .name('lz-cli')
    .version('0.0.1')
    .description('layerzero cli')
    .showHelpAfterError()
    .showSuggestionAfterError()

export { command }
