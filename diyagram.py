from graphviz import Digraph

def create_aco_diagram():
    dot = Digraph(comment='Ant Colony Optimization Algorithm for Satellite Refueling')
    dot.attr(rankdir='TB')
    
    # Node styles
    dot.attr('node', shape='rectangle', style='rounded')
    
    # Main process nodes
    dot.node('A', 'Start\nSatellites, Moon and Rocket\ninitial states')
    dot.node('B', 'Set ACO Parameters\n- Number of Ants\n- Number of Iterations\n- Evaporation Rate\n- Alpha, Beta, Q')
    dot.node('C', 'Calculate Distance Matrix\nDistances between all points')
    dot.node('D', 'Initialize Pheromone Matrix')
    
    # Iteration process
    dot.node('E', 'Start Iteration')
    dot.node('F', 'Construct Ant Solution')
    
    # Solution construction subprocess
    dot.node('G', 'Calculate Priorities\n- Fuel Level\n- Distance Factor')
    dot.node('H', 'Select Next Target\nPriority and Pheromone')
    dot.node('I', 'Fuel Check')
    dot.node('J', 'Return to Moon and\nRefuel')
    dot.node('K', 'Update Solution')
    
    # Pheromone update
    dot.node('L', 'Update Pheromones\n- Evaporate\n- Add New Pheromone')
    dot.node('M', 'Find Best Solution')
    dot.node('N', 'Result')
    
    # Edges
    dot.edge('A', 'B')
    dot.edge('B', 'C')
    dot.edge('C', 'D')
    dot.edge('D', 'E')
    dot.edge('E', 'F')
    dot.edge('F', 'G')
    dot.edge('G', 'H')
    dot.edge('H', 'I')
    dot.edge('I', 'J', 'Low Fuel')
    dot.edge('I', 'K', 'Sufficient Fuel')
    dot.edge('J', 'G')
    dot.edge('K', 'G', 'All satellites\nnot visited')
    dot.edge('K', 'L', 'All satellites\nvisited')
    dot.edge('L', 'E', 'Iteration\ncontinuing')
    dot.edge('L', 'M', 'Iterations\ncompleted')
    dot.edge('M', 'N')
    
    # Subgraph for iteration
    with dot.subgraph(name='cluster_0') as c:
        c.attr(label='For Each Iteration')
        c.attr('node', style='rounded')
        c.node('F')
        c.node('G')
        c.node('H')
        c.node('I')
        c.node('J')
        c.node('K')
        c.node('L')
    
    # Save the diagram
    dot.render('aco_diagram', format='png', cleanup=True)

if __name__ == "__main__":
    create_aco_diagram()
