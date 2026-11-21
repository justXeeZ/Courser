import type { CourseTree } from '@/types/course';

export const cs201DataStructures: CourseTree = {
  slug: 'cs201-data-structures',
  code: 'CS201',
  title: 'Data Structures & Algorithms',
  department: 'Computer Science',
  semester: 'Year 2 - First Semester',
  credits: 4,
  description:
    'Master core linear, hierarchical, and graph data structures alongside asymptotic complexity analysis and practical implementation labs.',
  chapters: [
    {
      id: 'cs201-ch1-linear',
      order: 1,
      title: '1. Complexity & Linear Data',
      weekRange: 'Weeks 1â€“3',
      description:
        'Big-O analysis, amortized bounds, contiguous memory arrays, and pointer-based linked structures.',
      lessons: [
        {
          id: 'cs201-big-o-analysis',
          title: 'Asymptotic Analysis',
          summary:
            'Formalize worst-case, average-case, and amortized time/space complexity using Big-O, Omega, and Theta notation.',
          notes:
            'Key takeaways:\n- Drop lower-order terms and constant factors when comparing asymptotic growth.\n- Know the Master Theorem cases for divide-and-conquer recurrences.\n- Practice counting primitive operations inside nested loops with dependent bounds.',
          side: 'left',
          resources: [
            {
              title: 'Lecture 01 Slides: Growth of Functions & Recurrences',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
              kind: 'slides',
            },
            {
              title: 'Big-O Cheat Sheet & Complexity Table',
              url: 'https://www.bigocheatsheet.com/',
              kind: 'reading',
            },
            {
              title: 'MIT 6.006 Lecture 1: Algorithms & Computation',
              url: 'https://www.youtube.com/watch?v=ZA-tUyM_y7s',
              kind: 'video',
            },
          ],
        },
        {
          id: 'cs201-dynamic-arrays',
          title: 'Dynamic Arrays',
          summary:
            'Understand contiguous memory layout, geometric growth factors, and why append achieves O(1) amortized time.',
          notes:
            'Key takeaways:\n- Doubling capacity on overflow yields O(1) amortized append by the accounting method.\n- Random access is O(1), while inserting/deleting at arbitrary indices is O(n).\n- Contiguous memory gives strong CPU cache locality compared to pointer-heavy structures.',
          side: 'left',
          prerequisites: ['cs201-big-o-analysis'],
          resources: [
            {
              title: 'Lab 01: Implement a Generic Resizable Vector',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/assignments/',
              kind: 'lab',
            },
            {
              title: 'Lecture 02 Slides: Static & Dynamic Arrays',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/',
              kind: 'slides',
            },
          ],
        },
        {
          id: 'cs201-linked-lists',
          title: 'Linked Lists',
          summary:
            'Compare singly, doubly, and circular linked lists; master sentinel nodes and in-place pointer reversal.',
          notes:
            'Key takeaways:\n- Use dummy head/tail sentinels to eliminate edge cases on empty lists.\n- Fast/slow pointer technique detects cycles in O(n) time and O(1) extra space.',
          side: 'right',
          prerequisites: ['cs201-dynamic-arrays'],
          resources: [
            {
              title: 'Lab 02: Doubly Linked List & LRU Cache Skeleton',
              url: 'https://visualgo.net/en/list',
              kind: 'lab',
            },
            {
              title: 'Visualizing Linked List Operations (VisuAlgo)',
              url: 'https://visualgo.net/en/list',
              kind: 'official',
            },
          ],
        },
        {
          id: 'cs201-binary-search',
          title: 'Binary Search',
          summary:
            'Apply loop invariants to binary search on sorted arrays and monotonic predicate spaces without off-by-one bugs.',
          notes:
            'Key takeaways:\n- Compute mid as lo + Math.floor((hi - lo) / 2) to prevent integer overflow.\n- Distinguish lower_bound (first >= target) from upper_bound (first > target).',
          side: 'right',
          prerequisites: ['cs201-dynamic-arrays'],
          resources: [
            {
              title: 'Binary Search Invariants Guide',
              url: 'https://cp-algorithms.com/num_methods/binary_search.html',
              kind: 'reading',
            },
            {
              title: 'Practice Set: Monotonic Predicate Problems',
              url: 'https://leetcode.com/tag/binary-search/',
              kind: 'assignment',
            },
          ],
        },
      ],
    },
    {
      id: 'cs201-ch2-adts-hashing',
      order: 2,
      title: '2. Stacks, Queues & Hashing',
      weekRange: 'Weeks 4â€“6',
      description:
        'Abstract data types for ordered access plus expected O(1) dictionaries via hash tables.',
      lessons: [
        {
          id: 'cs201-stacks-queues',
          title: 'Stacks & Queues',
          summary:
            'Implement LIFO stacks, FIFO queues, and circular ring buffers; apply monotonic stacks to span problems.',
          notes:
            'Key takeaways:\n- Circular arrays avoid O(n) shifts during dequeue.\n- Stacks underpin call frames, DFS, and expression evaluation.',
          side: 'left',
          prerequisites: ['cs201-linked-lists'],
          resources: [
            {
              title: 'Lecture 04 Slides: Stacks, Queues & Deques',
              url: 'https://algs4.cs.princeton.edu/13stacks/',
              kind: 'slides',
            },
            {
              title: 'Princeton Algorithms Ch. 1.3: Bags, Queues, and Stacks',
              url: 'https://algs4.cs.princeton.edu/13stacks/',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'cs201-hash-tables',
          title: 'Hash Tables',
          summary:
            'Design good hash functions and resolve collisions with separate chaining vs. open addressing.',
          notes:
            'Key takeaways:\n- Maintain load factor alpha = n / m below threshold (typically 0.75) via rehashing.\n- Open addressing requires tombstones on delete to preserve probe chains.',
          side: 'right',
          prerequisites: ['cs201-dynamic-arrays'],
          resources: [
            {
              title: 'Lab 03: Hash Map with Linear Probing',
              url: 'https://algs4.cs.princeton.edu/34hash/',
              kind: 'lab',
            },
            {
              title: 'Hashing & Universal Hash Families',
              url: 'https://www.youtube.com/watch?v=Nu8YGzuaxQU',
              kind: 'video',
            },
          ],
        },
        {
          id: 'cs201-heaps-priority-queues',
          title: 'Heaps & Priority Queues',
          summary:
            'Store complete binary heaps in flat arrays, build heaps in O(n), and perform O(log n) extract-min.',
          notes:
            'Key takeaways:\n- Parent of i is floor((i-1)/2); children are 2i+1 and 2i+2.\n- Floyd bottom-up heapify runs in O(n), not O(n log n).',
          side: 'left',
          prerequisites: ['cs201-dynamic-arrays'],
          resources: [
            {
              title: 'Binary Heaps & Heapsort Notes',
              url: 'https://algs4.cs.princeton.edu/24pq/',
              kind: 'textbook',
            },
            {
              title: 'Midterm 1 Review Pack: Linear Structures & Heaps',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/quizzes/',
              kind: 'exam',
            },
          ],
        },
      ],
    },
    {
      id: 'cs201-ch3-trees',
      order: 3,
      title: '3. Trees & Balanced Search',
      weekRange: 'Weeks 7â€“9',
      description:
        'Recursive hierarchical structures, binary search trees, rotations, and guaranteed O(log n) balance.',
      lessons: [
        {
          id: 'cs201-binary-trees',
          title: 'Binary Trees',
          summary:
            'Master tree terminology (height, depth, subtree) and preorder, inorder, postorder, and level-order traversals.',
          notes:
            'Key takeaways:\n- Express tree properties recursively by combining left and right subtree results.\n- Level-order traversal uses a FIFO queue.',
          side: 'left',
          prerequisites: ['cs201-stacks-queues'],
          resources: [
            {
              title: 'Lecture 07 Slides: Tree Traversals & Recursion',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/',
              kind: 'slides',
            },
            {
              title: 'VisuAlgo: Binary Trees',
              url: 'https://visualgo.net/en/bst',
              kind: 'official',
            },
          ],
        },
        {
          id: 'cs201-bst-operations',
          title: 'BST Operations',
          summary:
            'Implement search, insert, successor/predecessor queries, and Hibbard deletion on binary search trees.',
          notes:
            'Key takeaways:\n- Inorder traversal of a valid BST yields keys in sorted order.\n- Deleting a two-child node swaps with its inorder successor.',
          side: 'right',
          prerequisites: ['cs201-binary-trees'],
          resources: [
            {
              title: 'Lab 04: Ordered Map Using a BST',
              url: 'https://algs4.cs.princeton.edu/32bst/',
              kind: 'lab',
            },
            {
              title: 'BST Operations Textbook Chapter',
              url: 'https://algs4.cs.princeton.edu/32bst/',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'cs201-avl-red-black',
          title: 'AVL & Red-Black Trees',
          summary:
            'Maintain logarithmic height using left/right rotations, balance factors, and red-black coloring invariants.',
          notes:
            'Key takeaways:\n- Four AVL rotation cases: LL, RR, LR, RL.\n- Red-Black trees relax height balance slightly for fewer rotations during updates.',
          side: 'left',
          prerequisites: ['cs201-bst-operations'],
          resources: [
            {
              title: 'Balanced Search Trees Lecture Video',
              url: 'https://www.youtube.com/watch?v=U1JYwHcFfso',
              kind: 'video',
            },
            {
              title: 'AVL & Red-Black Rotation Reference',
              url: 'https://algs4.cs.princeton.edu/33balanced/',
              kind: 'reading',
            },
          ],
        },
      ],
    },
    {
      id: 'cs201-ch4-graphs',
      order: 4,
      title: '4. Graphs & Shortest Paths',
      weekRange: 'Weeks 10â€“13',
      description:
        'Model networks as graphs and solve reachability, topological ordering, shortest path, and spanning tree problems.',
      lessons: [
        {
          id: 'cs201-graph-representations',
          title: 'Graph Representations',
          summary:
            'Choose between adjacency lists, adjacency matrices, and edge lists based on density and query patterns.',
          notes:
            'Key takeaways:\n- Adjacency lists use O(V + E) memory and excel on sparse real-world graphs.\n- Adjacency matrices give O(1) edge lookup at O(V^2) space cost.',
          side: 'left',
          prerequisites: ['cs201-hash-tables'],
          resources: [
            {
              title: 'Lecture 10 Slides: Graph Representations',
              url: 'https://algs4.cs.princeton.edu/41graph/',
              kind: 'slides',
            },
          ],
        },
        {
          id: 'cs201-bfs-dfs',
          title: 'BFS & DFS',
          summary:
            'Traverse graphs in O(V + E) to find unweighted shortest paths, connected components, cycles, and topological order.',
          notes:
            'Key takeaways:\n- BFS explores vertices in non-decreasing distance from the source.\n- DFS discovery/finish timestamps classify tree, back, forward, and cross edges.',
          side: 'right',
          prerequisites: ['cs201-graph-representations', 'cs201-stacks-queues'],
          resources: [
            {
              title: 'Lab 05: Course Prerequisite Topological Sorter',
              url: 'https://cp-algorithms.com/graph/topological-sort.html',
              kind: 'lab',
            },
            {
              title: 'VisuAlgo: Graph Traversal (DFS/BFS)',
              url: 'https://visualgo.net/en/dfsbfs',
              kind: 'official',
            },
          ],
        },
        {
          id: 'cs201-dijkstra-shortest-path',
          title: 'Dijkstra Shortest Path',
          summary:
            'Compute single-source shortest paths on non-negative weighted graphs using a min-priority queue.',
          notes:
            'Key takeaways:\n- Greedy relaxation fails when negative edge weights exist (use Bellman-Ford instead).\n- Runs in O((V + E) log V) with a binary heap.',
          side: 'left',
          prerequisites: ['cs201-bfs-dfs', 'cs201-heaps-priority-queues'],
          resources: [
            {
              title: 'Shortest Paths Chapter (Princeton algs4)',
              url: 'https://algs4.cs.princeton.edu/44sp/',
              kind: 'textbook',
            },
            {
              title: 'Dijkstra Algorithm Walkthrough',
              url: 'https://cp-algorithms.com/graph/dijkstra_sparse.html',
              kind: 'reading',
            },
          ],
        },
        {
          id: 'cs201-mst-kruskal-prim',
          title: 'Minimum Spanning Trees',
          summary:
            'Connect weighted undirected graphs at minimum total cost using Prim and Kruskal with Disjoint Set Union.',
          notes:
            'Key takeaways:\n- Both algorithms rely on the cut property.\n- Union-Find with path compression + union by rank runs in near-O(1) amortized time.',
          side: 'right',
          prerequisites: ['cs201-dijkstra-shortest-path'],
          resources: [
            {
              title: 'MST & Union-Find Reference',
              url: 'https://algs4.cs.princeton.edu/43mst/',
              kind: 'textbook',
            },
            {
              title: 'Final Exam Past Papers & Graph Problem Pack',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/quizzes/',
              kind: 'exam',
            },
          ],
        },
      ],
    },
  ],
};
