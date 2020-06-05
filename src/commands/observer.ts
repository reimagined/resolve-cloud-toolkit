import chalk from 'chalk'

export = {
  command: 'observer',
  describe: chalk.green('account observer commands'),
  builder: yargs =>
    yargs.commandDir('observer', {
      extensions: ['ts', 'js']
    })
}
