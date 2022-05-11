const { gql } = require('apollo-server');


const algorithmTypeDefs = gql`
type Options { debug: Boolean pending: Boolean }

type Commit { id: String timestamp: String message: String }

type GitRepository { gitKind: String
  url: String
  branchName: String
  webUrl: String
  cloneUrl: String
  commit: Commit }

type Algorithms { 
 name: String
  cpu: String
  created: Float
  entryPoint: String
  env: String
  gpu: String
  mem: String
  minHotWorkers: Int
  modified: Float
  reservedMemory: String
  type: String
  algorithmImage: String
  version: String
  options: Options
  gitRepository: GitRepository }

type AutogeneratedMainType { algorithms: [Algorithms ] }

extend type Query {
    
    algorithms:[Algorithms]
    algorithmsByName(name: String!): Algorithms
}

`



module.exports = algorithmTypeDefs;