/* eslint-disable */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const archiver = require('archiver')

const zipAsset = async (directory, result) => {
  const resultOutput = path.resolve(process.cwd(), result)
  try {
    await execSync(`zip -r -9 --quiet ${JSON.stringify(resultOutput)} .`, {
      cwd: directory
    })
  } catch (error) {
    console.warn(error.message)
    await new Promise((resolve, reject) => {
      const options = {
        zlib: {
          level: 9
        }
      }

      const output = fs.createWriteStream(resultOutput)

      const archive = archiver('zip', options)

      archive.directory(directory, false)

      archive.pipe(output)
      archive.on('finish', resolve)
      archive.on('error', reject)

      archive.finalize()
    })
  }
}

const source = process.argv[2]
const target = process.argv[3]




zipAsset(source, target)
