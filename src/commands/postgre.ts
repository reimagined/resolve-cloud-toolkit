import chalk from 'chalk'

export = {
  command: 'postgre',
  describe: chalk.green('serverless postresql operations'),
  builder: yargs =>
    yargs.commandDir('postgre', {
      extensions: ['ts', 'js']
    })
}
