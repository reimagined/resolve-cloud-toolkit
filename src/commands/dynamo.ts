import chalk from 'chalk'

export = {
  command: 'dynamo',
  aliases: ['ddb'],
  describe: chalk.green('dynamoDB table operations'),
  builder: yargs =>
    yargs.commandDir('dynamo', {
      extensions: ['ts', 'js']
    })
}
