import chalk from 'chalk'

export = {
  command: 'cloudwatch',
  aliases: ['cw'],
  describe: chalk.green('cloud watch logs operations'),
  builder: yargs =>
    yargs.commandDir('cloudwatch', {
      extensions: ['ts', 'js']
    })
}
