const { gql } = require('apollo-server');


const dataSourcesTypeDefs = gql`

type DataSources { 
    versionDescription: String
    name: String
    filesCount: Int
    avgFileSize: Float
    totalSize: Int
    id: String
    fileTypes: [String ]
 }
 type Files {
  path: String
  id: String
  name: String
  size: Int
  type: String
  meta: String
  uploadedAt: String
}

type Storage {
  kind: String
}

type Git {
  kind: String
  repositoryUrl: String
}

   type DataSource {
   name: String
   versionDescription: String
   commitHash: String
   isPartial: Boolean
   id: String
   path: String
   files: [Files]
   storage: Storage
   git: Git
   }

type DataSourceVersions {
   versionDescription: String
  commitHash: String
  id: String
}
type DroppedFiles {
  path: String
  id: String
  name: String
  size: Int
  type: String
  meta: String
  uploadedAt: String
}

type FilteredFilesList {
  path: String
  id: String
  name: String
  size: Int
  type: String
  meta: String
  uploadedAt: String
}

type DataSourceMeta {
  id: String
  name: String
}

type DataSourceSnapanshots  {
  query: String
  name: String
  id: String
  droppedFiles: [DroppedFiles]
  filteredFilesList: [FilteredFilesList]
  dataSource: DataSourceMeta
}
 extend type Query {
    dataSources:[DataSources],
    dataSource(name:String!,id:String!): DataSource
    DataSourceVersions(name:String!): [DataSourceVersions]
    DataSourceSnapanshots(name:String!): [DataSourceSnapanshots],
    DataSourcePreviewQuery(id:String!,query:String!): [FilteredFilesList]

 }
`

module.exports = dataSourcesTypeDefs;