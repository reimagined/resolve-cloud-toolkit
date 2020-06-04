import chalk from 'chalk'

export = {
  command: 'dynamo',
  aliases: ['ddb'],
  describe: chalk.green('DynamoDB table operations'),
  builder: yargs =>
    yargs.commandDir('dynamo', {
      extensions: ['ts', 'js']
    })
}
