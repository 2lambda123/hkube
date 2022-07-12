const { gql } = require('apollo-server');

const experimentTypeDefs = gql`
type Experiments {
     name: String 
     description: String
      created: String 
    }

type AutogeneratedMainType { 
    experiments: [Experiments ]
 }

 extend type Query {
    experiments:[Experiments]
 }
`;

module.exports = experimentTypeDefs;
