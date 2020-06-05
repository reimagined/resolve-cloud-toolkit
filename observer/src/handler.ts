// eslint-disable-next-line import/no-unresolved
import { Context } from 'aws-lambda'
import log from 'consola'
import Lambda from 'aws-sdk/clients/lambda'
import https from 'https'
import IAM from 'aws-sdk/clients/iam'
import { isEmpty } from 'lodash'

type ObserverEvent = {
  name: string
  payload: {
    publish: boolean
  }
}

const isObserverEvent = (event: ObserverEvent | object): event is ObserverEvent =>
  !isEmpty((event as ObserverEvent).name)

const thresholds = {
  lambda: 950,
  role: 900
}

const makeCard = ({ account, region, lambdaCount, roleCount }) =>
  JSON.stringify({
    '@context': 'https://schema.org/extensions',
    '@type': 'MessageCard',
    themeColor: 'FF0000',
    text: `Account **${account}** region **${region}** usage alarm:`,
    sections: [
      {
        title: `Lambda functions: **${lambdaCount}** (**${thresholds.lambda}**)`
      },
      {
        title: `Roles: **${roleCount}** (**${thresholds.role}**)`
      }
    ]
  })

const countLambdas = async (lambda: Lambda, count = 0, marker = ''): Promise<number> => {
  const { NextMarker, Functions } = await lambda
    .listFunctions({
      Marker: isEmpty(marker) ? undefined : marker
    })
    .promise()
  const total = count + (Functions?.length || 0)
  if (NextMarker) {
    return countLambdas(lambda, total, NextMarker)
  }
  return total
}
const countRoles = async (iam: IAM, count = 0, marker = ''): Promise<number> => {
  const { Marker, Roles } = await iam
    .listRoles({
      Marker: isEmpty(marker) ? undefined : marker
    })
    .promise()
  const total = count + (Roles?.length || 0)
  if (Marker) {
    return countRoles(iam, total, Marker)
  }
  return total
}

const publish = async data => {
  const { RESOLVE_OBSERVER_WEB_HOOK = '' } = process.env

  if (isEmpty(RESOLVE_OBSERVER_WEB_HOOK)) {
    log.error(`empty hook url`)
    return
  }

  const message = makeCard(data)

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(message)
    }
  }

  await new Promise(resolve => {
    const req = https.request(RESOLVE_OBSERVER_WEB_HOOK, options, resolve)

    req.write(message)
    req.end()
  })
}

const thresholdExceeded = ({ lambdaCount, roleCount }) =>
  lambdaCount >= thresholds.lambda || roleCount >= thresholds.role

export const execute = async (event: ObserverEvent | object, context: Context): Promise<any> => {
  log.debug(`observer is starting`)
  const account = context.invokedFunctionArn.split(':')[4]
  const { AWS_REGION: region } = process.env
  if (isObserverEvent(event)) {
    log.debug(`gathering account and region statistics`)
    const [lambdaCount, roleCount] = await Promise.all([
      countLambdas(new Lambda()),
      countRoles(new IAM())
    ])

    log.debug(`lambdaCount: ${lambdaCount}`)
    log.debug(`roleCount: ${roleCount}`)

    const data = {
      account,
      region,
      lambdaCount,
      roleCount
    }

    if (event.payload.publish && thresholdExceeded(data)) {
      await publish(data)
    }

    return data
  }
  const error = Error(`unknown input event`)
  log.error(error)
  log.error(event)
  throw error
}
