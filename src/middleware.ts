import AWS from 'aws-sdk'
import log from 'consola'

export const verbosityLevels = {
  silent: -1,
  normal: 3,
  debug: 4,
  trace: 5
}

export const middleware = (args): void => {
  const { verbosity, profile, region } = args

  log.level = verbosityLevels[verbosity] || 3

  if (profile) {
    log.debug(`setting aws sdk profile to ${profile}`)
    AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile })

    log.debug(`setting aws sdk region to ${region}`)
    AWS.config.region = region
  }
}
