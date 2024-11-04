import { IdToken } from '@auth0/auth0-spa-js'
import { LoginIdentity } from 'src/types'

export const idTokenToLoginIdentity = (claim: IdToken): LoginIdentity => {
  return {
    name: claim['name'] || '',
    email: claim['email'] || '',
    agencyCloudId: claim['custom:reapit:agencyCloudId'] || null,
    developerId: claim['custom:reapit:developerId'] || null,
    clientId: claim['custom:reapit:clientCode'] || null,
    adminId: claim['custom:reapit:marketAdmin'] || null,
    userCode: claim['custom:reapit:userCode'] || null,
    groups: claim['cognito:groups'] || [],
    orgName: claim['custom:reapit:orgName'] || null,
    orgId: claim['custom:reapit:orgId'] || null,
    offGroupIds: claim['custom:reapit:offGroupIds'] || null,
    offGrouping: claim['custom:reapit:offGrouping'] && claim['custom:reapit:offGrouping'] === 'true' ? true : false,
    offGroupName: claim['custom:reapit:offGroupName'] || null,
    officeId: claim['custom:reapit:officeId'] || null,
    orgProduct: claim['custom:reapit:orgProduct'] || null,
  }
}
