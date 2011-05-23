(function($) {

    $(document).ready(function() {
        if ($('#social_graph').length > 0) {
            // init ForceDirected
            var fd = new $jit.ForceDirected({
                //id of the visualization container
                injectInto: 'social_graph',
                //Enable zooming and panning
                //with scrolling and DnD
                Navigation: {
                    enable: true,
                    //Enable panning events only if we're dragging the empty
                    //canvas (and not a node).
                    panning: 'avoid nodes',
                    zooming: 10 //zoom speed. higher is more sensible
                },
                // Change node and edge styles such as
                // color and width.
                // These properties are also set per node
                // with dollar prefixed data-properties in the
                // JSON structure.
                Node: {
                    overridable: true,
                    dim: 7
                },
                Edge: {
                    overridable: true,
                    color: '#23A4FF',
                    lineWidth: 1.0
                },
                //Add Tips
                Tips: {
                    enable: true,
                    type: 'Native',
                    onShow: function(tip, node) {
                        //count connections
                        var count = 0;
                        node.eachAdjacency(function() {
                            count++;
                        });
                        //display node info in tooltip
                        if (node.name) {
                            node.data.name = node.name;
                        }
                        $(tip).empty().alpaca({
                            "data": node.data,
                            "view": {
                                "globalTemplate": '../../templates/SocialGraphTip.html'
                            }
                        });
                    }
                },
                // Add node events
                Events: {
                    enable: true,
                    type: 'Native',
                    //Change cursor style when hovering a node
                    onMouseEnter: function() {
                        fd.canvas.getElement().style.cursor = 'move';
                    },
                    onMouseLeave: function() {
                        fd.canvas.getElement().style.cursor = '';
                    },
                    //Update node positions when dragged
                    onDragMove: function(node, eventInfo, e) {
                        var pos = eventInfo.getPos();
                        node.pos.setc(pos.x, pos.y);
                        fd.plot();
                    },
                    //Implement the same handler for touchscreens
                    onTouchMove: function(node, eventInfo, e) {
                        $jit.util.event.stop(e); //stop default touchmove event
                        this.onDragMove(node, eventInfo, e);
                    }
                },
                //Number of iterations for the FD algorithm
                iterations: 200,
                //Edge length
                levelDistance: 130,
                // This method is only triggered
                // on label creation and only for DOM labels (not native canvas ones).
                onCreateLabel: function(domElement, node) {
                    // Create a 'name' and 'close' buttons and add them
                    // to the main node label
                    var nameContainer = document.createElement('span'),
                            closeButton = document.createElement('span'),
                            style = nameContainer.style;
                    nameContainer.className = 'name';
                    nameContainer.innerHTML = node.name;
                    closeButton.className = 'close';
                    closeButton.innerHTML = 'x';
                    domElement.appendChild(nameContainer);
                    if (!node.data.isAssociation) {
                        domElement.appendChild(closeButton);
                    }
                    style.fontSize = "1.2em";
                    style.color = "#111";
                    //Fade the node and its connections when
                    //clicking the close button
                    closeButton.onclick = function() {
                        node.setData('alpha', 0, 'end');
                        node.eachAdjacency(function(adj) {
                            adj.setData('alpha', 0, 'end');
                        });
                        fd.fx.animate({
                            modes: ['node-property:alpha',
                                'edge-property:alpha'],
                            duration: 500
                        });
                    };
                    //Toggle a node selection when clicking
                    //its name. This is done by animating some
                    //node styles like its dimension and the color
                    //and lineWidth of its adjacencies.
                    nameContainer.onclick = function() {
                        //set final styles
                        fd.graph.eachNode(function(n) {
                            if (n.id != node.id) delete n.selected;
                            n.setData('dim', 7, 'end');
                            n.eachAdjacency(function(adj) {
                                adj.setDataset('end', {
                                    lineWidth: 0.4,
                                    color: '#23a4ff'
                                });
                            });
                        });
                        if (!node.selected) {
                            node.selected = true;
                            node.setData('dim', 17, 'end');
                            node.eachAdjacency(function(adj) {
                                adj.setDataset('end', {
                                    lineWidth: 3,
                                    color: '#36acfb'
                                });
                            });
                        } else {
                            delete node.selected;
                        }
                        //trigger animation to final styles
                        fd.fx.animate({
                            modes: ['node-property:dim',
                                'edge-property:lineWidth:color'],
                            duration: 500
                        });
                        // Build the right column relations list.
                        // This is done by traversing the clicked node connections.
                        /*
                         var html = "<h4>" + node.name + "</h4><b> connections:</b><ul><li>",
                         list = [];
                         node.eachAdjacency(function(adj) {
                         if (adj.getData('alpha')) list.push(adj.nodeTo.name);
                         });
                         */
                        //append connections information
                        /*
                         $jit.id('social-details').innerHTML = html + list.join("</li><li>") + "</li></ul>";
                         */
                        var detailsElem = $('#social-details');
                        detailsElem.empty();
                        var userId = node.id;
                        var user = userListJson[userId];
                        var personNode = personNodeListJson[userId];
                        var data = {
                            "user" : {
                                "firstName": user.getFirstName(),
                                "lastName": user.getLastName(),
                                "email": user.getEmail(),
                                "attachments": {}
                            },
                            "personNode" : {
                                "currentPosition": personNode.get('currentPosition'),
                                "gender": personNode.get('gender'),
                                "biography": personNode.get('biography')
                            }
                        };
                        user.chain().attachment().each(function() {
                            data.user.attachments[this.getId()] = this.getDownloadUri();
                        });
                        personNode.chain().traverse({
                            "associations": {
                                "theoffice:isManager": "BOTH",
                                "theoffice:hasRelation": "BOTH"
                            },
                            "depth": 1
                        }).then(function() {
                            var nodes = this.object.nodes;
                            var associations = this.object.associations;
                            var supervisors = [];
                            var subordinates = [];
                            var relationships = [];
                            var personNodeId = personNode.getId();
                            for (var key in associations) {
                                var type = associations[key]["_type"];
                                var direction = associations[key]["direction"];
                                var sourceId = associations[key]["source"];
                                var targetId = associations[key]["target"];
                                var targetNode = nodes[associations[key]["target"]];
                                var sourceNode = nodes[associations[key]["source"]];
                                if (type == 'theoffice:isManager') {
                                    if (personNodeId == sourceId) {
                                        subordinates.push({
                                            "userId": targetNode["userId"]
                                        });
                                    }
                                    if (personNodeId == targetId) {
                                        supervisors.push({
                                            "userId": sourceNode["userId"]
                                        });
                                    }
                                }
                                if (type == 'theoffice:hasRelation') {
                                    var relationship = {};
                                    if (personNodeId == sourceId) {
                                        relationship.userId = targetNode["userId"];
                                    }
                                    if (personNodeId == targetId) {
                                        relationship.userId = sourceNode["userId"];
                                    }
                                    relationship.type = associations[key].details.type;
                                    relationships.push(relationship);
                                }
                            }
                            data.supervisors = supervisors;
                            data.subordinates = subordinates;
                            data.relationships = relationships;

                            detailsElem.empty().alpaca({
                                "data": data,
                                "view": {
                                    "globalTemplate": '../../templates/SocialGraphUserDetails.html'
                                },
                                "postRender": function(renderedField) {
                                    $('.supervisor,.subordinate,.relationship', detailsElem).each(function(index) {
                                        var userId = $(this).attr('id');
                                        $(this).html(userListJson[userId].getFirstName() + ' ' + userListJson[userId].getLastName());
                                        $(this).click(function() {
                                            $('div#' + userId + '>span.name').click();
                                        });
                                    });
                                }
                            });
                        });
                    };
                },
                // Change node styles when DOM labels are placed
                // or moved.
                onPlaceLabel: function(domElement, node) {
                    var style = domElement.style;
                    var left = parseInt(style.left);
                    var top = parseInt(style.top);
                    var w = domElement.offsetWidth;
                    style.left = (left - w / 2) + 'px';
                    style.top = (top + 10) + 'px';
                    style.display = '';
                }
            });

            var defaults = Gitana.SDK.defaults;

            var branch;

            var server;

            var userListJson = {};
            var personNodeListJson = {};
            var personNodeUserMap = {};
            var helperMap = {};

            new Gitana().authenticate(defaults.userName, defaults.password).trap(defaults.errorHandler).then(function() {

                var server = this;

                var json = [];
                this.listUsers().each(function() {
                    userListJson[this.getId()] = this;
                });

                this.queryRepositories(defaults.repositoryQuery).keep(1).each(function() {
                    this.readBranch('master').then(function() {
                        branch = this;
                        this.queryNodes({
                            "_type" : "n:person"
                        }).each(function() {
                            var personNode = this;
                            var userId = personNode.getUserId();
                            personNodeListJson[userId] = personNode;
                            personNodeUserMap[personNode.getId()] = userId;
                            var user = userListJson[userId];
                            if (user != null) {
                                //Prepare Initial Json for social graph
                                var userSocialGraphNode = {
                                    "adjacencies": [
                                    ],
                                    "data": {
                                        "$color": "#83548B",
                                        "$type": "square",
                                        "$dim": 8
                                    },
                                    "id": userId,
                                    "name": user.getFirstName() + " " + user.getLastName()
                                };
                                if (personNode.get('currentPosition')) {
                                    userSocialGraphNode.data.currentPosition = personNode.get('currentPosition');
                                }
                                if (personNode.get('gender') && personNode.get('gender') == 'female') {
                                    userSocialGraphNode.data.$color = '#008B8B';
                                }
                                user.chain().attachment().each(function() {
                                    userSocialGraphNode.data[this.getId()] = this.getDownloadUri();
                                });
                                json.push(userSocialGraphNode);
                                helperMap[personNode.getId()] = json.length - 1;
                                var employeeItem = $('<li><a href="#">' + userSocialGraphNode.name + '</a></li>');
                                employeeItem.appendTo($('#employee_list'));
                                employeeItem.click(function() {
                                    $('div#' + userId + '>span.name').click();
                                });
                            }
                        });
                        this.queryNodes({
                            "source_type" : "n:person",
                            "target_type" : "n:person"
                        }).each(
                                function() {
                                    var associationNode = this;
                                    if ((associationNode.get('direction') == 'OUTGOING' || associationNode.get('direction') == 'BOTH') && !Alpaca.startsWith(associationNode.get('_type'), "a:")) {

                                        //Prepare Initial Json for social graph
                                        var associationSocialGraphNode = {
                                            "adjacencies": [
                                            ],
                                            "data": {
                                                "$color": "#FFA500",
                                                "$type": "circle",
                                                "$dim": 6,
                                                "isAssociation": true,
                                                "associationType": associationNode.get('_type'),
                                                "details": associationNode.get('details')
                                            },
                                            "id": associationNode.getId(),
                                            "name": ""
                                        };

                                        var itemIndex = helperMap[associationNode.get('source')];
                                        if (itemIndex != null && personNodeUserMap[associationNode.get('target')] != null) {
                                            associationSocialGraphNode.data.sourceUser = json[itemIndex].name;
                                            associationSocialGraphNode.data.targetUser = json[helperMap[associationNode.get('target')]].name;
                                            var associationSocialGraphEdgeNodeA = {
                                                "nodeTo": associationSocialGraphNode.id,
                                                "nodeFrom": personNodeUserMap[associationNode.get('source')],
                                                "data": {
                                                    "$type": "arrow",
                                                    "$direction": [personNodeUserMap[associationNode.get('source')], associationSocialGraphNode.id]
                                                }
                                            };
                                            if (associationNode.get('direction') == 'BOTH') {
                                                associationSocialGraphEdgeNodeA.data.$type = "line";
                                                associationSocialGraphEdgeNodeA.data.$color = "#00FF66";
                                            }
                                            json[itemIndex].adjacencies.push(associationSocialGraphEdgeNodeA);
                                            var associationSocialGraphEdgeNodeB = {
                                                "nodeTo": personNodeUserMap[associationNode.get('target')],
                                                "nodeFrom": associationSocialGraphNode.id,
                                                "data": {
                                                    "$type": "arrow",
                                                    "$direction": [associationSocialGraphNode.id, personNodeUserMap[associationNode.get('target')]]
                                                }
                                            };
                                            if (associationNode.get('direction') == 'BOTH') {
                                                associationSocialGraphEdgeNodeB.data.$type = "line";
                                                associationSocialGraphEdgeNodeB.data.$color = "#00FF66";
                                            }
                                            associationSocialGraphNode.adjacencies.push(associationSocialGraphEdgeNodeB);
                                        }


                                        json.push(associationSocialGraphNode);

                                    }
                                }).then(function() {
                            // load JSON data.
                            fd.loadJSON(json);
                            // compute positions incrementally and animate.
                            fd.computeIncremental({
                                iter: 40,
                                property: 'end',
                                onStep: function(perc) {
                                    Log.write("Social graph data " + perc + '% loaded...');
                                },
                                onComplete: function() {
                                    Log.write('');
                                    fd.animate({
                                        modes: ['linear'],
                                        transition: $jit.Trans.Elastic.easeOut,
                                        duration: 2500
                                    });
                                }
                            });
                        });

                    });
                });
            });
        }
    });

})(jQuery);