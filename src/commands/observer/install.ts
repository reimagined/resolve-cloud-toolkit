import Lambda from 'aws-sdk/clients/lambda'
import IAM, { Role } from 'aws-sdk/clients/iam'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import log from 'consola'
import { ensureRoleWithPolicy } from 'resolve-cloud-common/iam'
import { Options, retry } from 'resolve-cloud-common/utils'
import { observerLambdaName, observerRoleName } from '../../utils'

const observerPath = path.resolve(__dirname, '../../../observer')
const observerRole = path.resolve(observerPath, 'role.json')
const observerAsset = path.resolve(observerPath, 'code.zip')

const stsAssumeRolePolicy = (): Array<object> => [
  {
    Effect: 'Allow',
    Principal: { Service: 'lambda.amazonaws.com', AWS: '*' },
    Action: 'sts:AssumeRole'
  }
]
const createPolicy = (...statements: Array<object>[]): string =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: statements.reduce((a, i) => a.concat(i), [])
  })

const ensureRole = async args => {
  const iam = new IAM()
  const iamCreateRole = retry(iam, iam.createRole)
  const iamPutRolePolicy = retry(iam, iam.putRolePolicy)
  const iamGetRole = retry(
    iam,
    iam.getRole,
    Options.Defaults.override({
      expectedErrors: ['NoSuchEntity']
    })
  )

  const name = observerRoleName(args.identifier)

  log.debug(`ensuring observer role ${name}`)
  log.debug(`retrieving observer role policy document`)

  const document = fs.readFileSync(observerRole).toString('utf-8')

  let role: Role
  try {
    log.debug(`retrieving role ${name}`)
    role = (await iamGetRole({ RoleName: name })).Role
    log.debug(`role ${name} already exist`)
    if (!args.force) {
      throw Error(
        `(${args.identifier}) observer's role already installed within account, use --force to update`
      )
    }
  } catch (error) {
    if (error.code === 'NoSuchEntity') {
      log.debug(`role ${name} not found, will try to create one`)

      role = (
        await iamCreateRole({
          AssumeRolePolicyDocument: createPolicy(stsAssumeRolePolicy()),
          RoleName: name,
          Description: 'ReSolve Cloud observer role'
        })
      ).Role

      log.debug(`role ${name} created successfully`)
    } else {
      throw error
    }
  }

  const policyName = 'general-policy'

  log.debug(`updating role ${name} inline policy ${policyName}`)

  await iamPutRolePolicy({
    RoleName: name,
    PolicyName: policyName,
    PolicyDocument: document
  })

  log.debug(`role ${name} inline policy ${policyName} updated`)
  return { roleArn: role.Arn }
}

const ensureLambda = async (args, roleArn: string) => {
  const lambda = new Lambda()
  const lambdaCreateFunction = retry(lambda, lambda.createFunction)
  const lambdaUpdateFunctionCode = retry(lambda, lambda.updateFunctionCode)
  const lambdaUpdateFunctionConfiguration = retry(lambda, lambda.updateFunctionConfiguration)

  const functionName = observerLambdaName(args.identifier)

  log.debug(`retrieving lambda ${functionName}`)

  let exist = true

  try {
    await lambda
      .getFunction({
        FunctionName: functionName
      })
      .promise()
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      exist = false
    } else {
      throw error
    }
  }

  if (exist && !args.force) {
    throw Error(
      `(${args.identifier}) observer's lambda already installed within account, use --force to update`
    )
  }

  const environment = {
    RESOLVE_OBSERVER_WEB_HOOK: args.hook
  }

  if (!exist) {
    log.debug(`lambda does not exist, creating`)

    await lambdaCreateFunction({
      FunctionName: functionName,
      Role: roleArn,
      Code: {
        ZipFile: fs.readFileSync(observerAsset)
      },
      Runtime: 'nodejs10.x',
      Handler: 'lib/handler.execute',
      Environment: {
        Variables: environment
      }
    })

    log.debug(`lambda created successfully`)
  } else {
    log.debug(`updating lambda function code`)
    await lambdaUpdateFunctionCode({
      FunctionName: functionName,
      Publish: true,
      ZipFile: fs.readFileSync(observerAsset)
    })
    log.debug(`lambda function code updated successfully`)
    log.debug(`updating lambda environment`)

    await lambdaUpdateFunctionConfiguration({
      FunctionName: functionName,
      Role: roleArn,
      Environment: {
        Variables: environment
      }
    })

    log.debug(`lambda environment updated successfully`)
  }
}

const handler = async (args): Promise<void> => {
  if (!args['skip-build']) {
    log.debug(`building observer's asset`)

    await execSync(`yarn archive`, {
      cwd: observerPath
    })

    log.debug(`asset ready to deploy`)
  } else {
    log.debug(`skipping asset building`)
  }

  const { roleArn } = await ensureRole(args)
  await ensureLambda(args, roleArn)

  log.debug(`(${args.identifier}) observer installed successfully`)
}

export = {
  handler,
  command: 'install <hook>',
  describe: chalk.green('installs current observer'),
  builder: yargs =>
    yargs
      .positional('hook', {
        describe: chalk.green('remote web-hook used to publish observer notifications'),
        type: 'string'
      })
      .option('identifier', {
        describe: chalk.green('observer identifier (multiple instances)'),
        alias: 'id',
        type: 'string',
        default: 'default'
      })
      .option('skip-build', {
        describe: chalk.green('skip asset building (code.zip)'),
        type: 'boolean',
        default: false
      })
      .option('force', {
        describe: chalk.green('force installation if the observer already installed'),
        type: 'boolean',
        default: false
      })
}
