// eslint-disable-next-line import/no-unresolved
import { Context } from 'aws-lambda'

export const execute = async (event: object, context: Context): Promise<any> => {
  console.log('executed successfully')
}
