import fs from 'fs'
import { promisify } from 'util'
import Promise from 'bluebird'
import chalk from 'chalk'
import log from 'consola'
import CloudWatch from 'aws-sdk/clients/cloudwatchlogs'

const openFile = promisify(fs.open)
const writeFile = promisify(fs.write)
const closeFile = promisify(fs.close)
const truncateFile = promisify(fs.truncate)

const mapEvents = async (
  cw: CloudWatch,
  logGroupName: string,
  logStreamName: string,
  fd: number,
  nextToken: any = undefined
): Promise<void> => {
  const { events, nextForwardToken } = await cw
    .getLogEvents({
      logGroupName,
      logStreamName,
      startFromHead: true,
      nextToken
    })
    .promise()

  if (!nextToken) {
    log.trace(`${logStreamName}: started`)
  }

  if (events && events.length) {
    log.trace(`${logStreamName}: >> ${events?.length} events to the output file`)
    events.map(event => writeFile(fd, `${new Date(event.timestamp || 0)}: ${event.message}`))
  }
  if (nextForwardToken !== nextToken) {
    await mapEvents(cw, logGroupName, logStreamName, fd, nextForwardToken)
  } else {
    log.trace(`${logStreamName}: completed`)
  }
}

const mapGroup = async (
  cw: CloudWatch,
  logGroupName: string,
  fd: number,
  next: any = undefined
): Promise<void> => {
  const { logStreams, nextToken } = await cw
    .describeLogStreams({
      logGroupName,
      nextToken: next
    })
    .promise()

  log.trace(`writing ${logStreams?.length} log streams to output file`)

  await Promise.each(logStreams, stream => mapEvents(cw, logGroupName, stream.logStreamName, fd))

  if (nextToken) {
    log.trace(`more log streams exists, continue`)
    await mapGroup(cw, logGroupName, fd, nextToken)
  }
}

const handler = async (args): Promise<void> => {
  const { group, file } = args

  log.debug(`building cloud watch client`)
  const cw = new CloudWatch()

  try {
    log.debug(`truncating file ${file}`)
    await truncateFile(file)
  } catch (err) {
    log.trace(err.message)
  }

  log.debug(`opening file ${file}`)
  const fd = await openFile(file, 'w')

  try {
    log.start(`starting streaming logs ${group} to the file ${file}`)
    await mapGroup(cw, group, fd)

    log.success(`completed`)
  } finally {
    log.debug(`closing file ${file}`)
    await closeFile(fd)
  }
}

export = {
  handler,
  command: 'export <group> <file>',
  describe: chalk.green('exports cloud watch log streams to a file'),
  builder: yargs =>
    yargs
      .positional('group', {
        describe: chalk.green("an existing table's id"),
        type: 'string'
      })
      .positional('file', {
        describe: chalk.green('a file to write to'),
        type: 'string'
      })
}
