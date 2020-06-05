import chalk from 'chalk'
import log from 'consola'
import CloudWatchEvents from 'aws-sdk/clients/cloudwatchevents'
import { deleteRole } from 'resolve-cloud-common/iam'
import { deleteFunction } from 'resolve-cloud-common/lambda'
import { retry } from 'resolve-cloud-common/utils'
import { observerLambdaName, observerRoleName, observerCloudWatchRuleName } from '../../utils'

const handler = async (args): Promise<void> => {
  const { identifier } = args

  log.debug(`uninstalling (${identifier}) observer`)

  const functionName = observerLambdaName(identifier)
  log.debug(`deleting lambda ${functionName}`)

  try {
    await deleteFunction({
      Region: args.region,
      FunctionName: functionName
    })
  } catch (error) {
    log.warn(error.message)
  }

  log.debug(`lambda function deleted`)

  const roleName = observerRoleName(identifier)
  log.debug(`deleting role ${roleName}`)

  try {
    await deleteRole({
      RoleName: roleName,
      Region: args.region
    })
  } catch (error) {
    log.warn(error.message)
  }

  log.debug(`role deleted`)

  const ruleName = observerCloudWatchRuleName(identifier)
  log.debug(`deleting cloud watch rule ${ruleName}`)

  const cwe = new CloudWatchEvents()
  const cweDeleteRule = retry(cwe, cwe.deleteRule)
  const cweRemoveTargets = retry(cwe, cwe.removeTargets)

  try {
    await cweRemoveTargets({
      Rule: ruleName,
      Ids: ['observer']
    })
  } catch (error) {
    log.warn(error.message)
  }

  try {
    await cweDeleteRule({
      Name: ruleName
    })
  } catch (error) {
    log.warn(error.message)
  }

  log.debug(`cloud watch rule deleted`)

  log.debug(`(${args.identifier}) observer installed successfully`)
}

export = {
  handler,
  command: 'uninstall',
  describe: chalk.green('installs current observer'),
  builder: yargs =>
    yargs.option('identifier', {
      describe: chalk.green('observer identifier (multiple instances)'),
      alias: 'id',
      type: 'string',
      default: 'default'
    })
}
