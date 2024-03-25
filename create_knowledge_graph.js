
let upload = document.getElementById('upload');
let parser = new N3.Parser();

function getFragmentFromIRI(iri) {
  return iri.split('#').pop();
}

function get_knowledge_asset_features(triples) {
  let features = triples.filter(t => t.object == "KnowledgeAssetFeature" && t.predicate == "subClassOf").map(t => ({ type: 'KnowledgeAssetFeature', name: t.subject }));
  return features;
}



function get_knowledge_asset_features_relationships(triples) {
  let features = triples.filter(t => t.object == "KnowledgeAssetFeature" && t.predicate == "subClassOf").map(t => t.subject);
  let feature_relationships = [];
  for (let feature of features) {
    feature_relationships.push(...triples.filter(t => t.predicate == "has" + feature).map(t => ({ source: t.subject, target: feature, type: t.predicate })));
  }
  return feature_relationships
}


function get_knows_relationship(triples) {
  let knows_relationship = [];
  let person = "";
  let magnitude = "";
  let knowledge_asset = "";
  let knowledge_observations = triples.filter(t => t.predicate == 'type' && t.object == 'KnowledgeObservation')
  for (const ko of knowledge_observations) {
    person = triples.find(t => t.predicate == 'hasPerson' && t.subject == ko.subject).object
    knowledge_asset = triples.find(t => t.predicate == 'hasKnowledgeAsset' && t.subject == ko.subject).object
    magnitude = triples.find(t => t.predicate == 'hasMagnitude' && t.subject == ko.subject).object
    knows_relationship.push({ source: person, target: knowledge_asset, type: "knows (magnitude=" + magnitude + ")" })
  }
  return knows_relationship
}

function getEdges(triples) {
  get_knowledge_asset_features_relationships(triples)
  const related_to = triples.filter(t => (t.predicate == 'relatedTo')).map(t => ({ source: t.subject, target: t.object, type: "related to" }));
  const composed_of = triples.filter(t => (t.predicate == 'composedOf')).map(t => ({ source: t.subject, target: t.object, type: "composed of" }));
  const depends_on = triples.filter(t => (t.predicate == 'dependsOn')).map(t => ({ source: t.subject, target: t.object, type: "depends on" }));
  return [].concat.apply([], [related_to, composed_of, depends_on, get_knows_relationship(triples), get_knowledge_asset_features_relationships(triples)]);
}

function getNodes(triples) {
  const knowledgeAssetNodes = triples.filter(t => (t.predicate == 'type' && t.object == 'KnowledgeAsset')).map(t => ({ type: 'KnowledgeAsset', name: t.subject }));
  const personNodes = triples.filter(t => (t.predicate == 'type' && t.object == 'Person')).map(t => ({ type: 'Person', name: t.subject }));
  return [].concat.apply([], [knowledgeAssetNodes, personNodes, get_knowledge_asset_features(triples)]);
}

/*
-------------------
| PARSE RDF GRAPH |
-------------------
 */
function getAbstractGraph(turtle_serialisation) {
  return new Promise((resolve, reject) => {
    let triples = [];
    let nodes = [];
    parser.parse(turtle_serialisation, function (error, triple, prefixes_) {
      if (error) {
        reject(error); // Reject the Promise if there's an error
        return;
      }
      if (triple) {
        triples.push({
          subject: getFragmentFromIRI(triple.subject.value),
          predicate: getFragmentFromIRI(triple.predicate.value),
          object: getFragmentFromIRI(triple.object.value)
        });
      } else {
        resolve({
          entities: getNodes(triples),
          relations: getEdges(triples)
        }); // Resolve the Promise with the result
      }
    });
  });
}

function visualiseGraph(knowledge_graph_json) {
  let nodes = []
  let edges = []

  for (const index in knowledge_graph_json['entities']) {
    nodes.push({
      data: { id: knowledge_graph_json['entities'][index]['name'], type: knowledge_graph_json['entities'][index]['type'], }
    });
  }

  for (const index in knowledge_graph_json['relations']) {
    edges.push({
      data: {
        id: index,
        source: knowledge_graph_json['relations'][index]['source'],
        target: knowledge_graph_json['relations'][index]['target'],
        label: knowledge_graph_json['relations'][index]['type'],
      }
    });
  }
  cytoscape({
    container: document.getElementById('cy'),
    boxSelectionEnabled: false,
    autounselectify: true,
    style: cytoscape.stylesheet()
      .selector('node')
      .css({
        "label": "data(id)",
        'height': 80,
        'width': 80,
        'background-fit': 'cover',
        'border-color': '#000',
        'border-width': 3,
        'border-opacity': 0.5
      })
      .selector('.eating')
      .css({
        'border-color': 'red'
      })
      .selector('.eater')
      .css({
        'border-width': 9
      })
      .selector('edge')
      .css({
        'label': 'data(label)',
        'curve-style': 'bezier',
        'width': 6,
        'target-arrow-shape': 'triangle',
        'line-color': '#ffaaaa',
        'target-arrow-color': '#ffaaaa',
        'background-color': 'white'
      })
      .selector('node[type = "Person"]')
      .css({
        'background-color': 'white',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'background-image': 'https://raw.githubusercontent.com/andimon/rdf-knowledge-landscape/dev/resouces/icons/user.png'
      })
      .selector('node[type = "KnowledgeAsset"]')
      .css({
        'text-valign': 'center',
        'text-halign': 'center',
        'background-color': 'cyan',
      }),

    elements: {
      nodes: nodes,
      edges: edges
    },

    layout: {
      name: 'breadthfirst',
      directed: true,
      padding: 10
    }
  });
}

/*
---------------------------
| Listen to upload button |
---------------------------
 */

upload.addEventListener('change', () => {
  let fr = new FileReader();
  fr.readAsText(upload.files[0]);
  fr.onload = function () {
    getAbstractGraph(fr.result).then(result => {
      visualiseGraph(result)
    }).catch(error => {
      console.error('Error:', error); // Handle errors here
    })
    // generateGraph(JSON.parse(fr.result))
  }
})
