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

type Algorithm { 
 
  name: String
  cpu: String
  created: Float
  entryPoint: String
  debugUrl: String
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
  gitRepository: GitRepository
  buildStats: BuildStatsForAlgorithm
  errors:[Int]
   }

type AutogeneratedAlgorithms { list: [Algorithm ],algorithmsCount:Int }

extend type Query {
    
    algorithms:AutogeneratedAlgorithms
    algorithmsByName(name: String!): Object
}

`;

module.exports = algorithmTypeDefs;
