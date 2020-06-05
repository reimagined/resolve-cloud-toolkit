import chalk from 'chalk'

export = {
  command: 'lambda',
  describe: chalk.green('lambda operations'),
  builder: yargs =>
    yargs.commandDir('lambda', {
      extensions: ['ts', 'js']
    })
}
