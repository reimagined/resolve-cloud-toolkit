#!/usr/bin/env node

import log from 'consola'
import yargs from 'yargs'
import chalk from 'chalk'
import { middleware, verbosityLevels } from './middleware'

yargs
  .commandDir('commands', {
    extensions: ['js', 'ts']
  })
  .completion('completion', chalk.green('generate bash completion script'))
  .middleware(middleware)
  .recommendCommands()
  .scriptName('resolve-cloud-toolkit')
  .strict()
  .wrap(128)
  .demandCommand(1, '')
  .help()
  .showHelpOnFail(true)
  .usage(
    `\n${chalk.blue('$0')} <command> [sub-command] [arguments]\n${chalk.blue(
      '$0'
    )} <command> --help\n${chalk.blue('$0')} --version`
  )
  .option('help', { hidden: true })
  .option('version', { hidden: true })
  .option('verbosity', {
    describe: 'set output verbosity level',
    type: 'string',
    choices: Object.keys(verbosityLevels)
  })
  .option('profile', {
    describe: 'set aws sdk profile',
    type: 'string'
  })
  .fail((msg, err) => {
    if (msg) {
      log.error(msg)
    }
    if (err) {
      log.error(err.message)
    }
    process.exit(1)
  })
  .parse()
