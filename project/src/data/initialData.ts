import { CurriculumData } from '../types/curriculum';

export const initialCurriculumData: CurriculumData = {
  gradeBands: [
    { id: 'early-years', name: 'Early Years', cycle: 'Foundation', grades: 'Pre-K & Kindergarten', ages: 'Ages 3-6' },
    { id: 'elementary', name: 'Elementary', cycle: 'Cycle 1', grades: 'Grades 1-4', ages: 'Ages 6-10' },
    { id: 'middle-school', name: 'Middle School', cycle: 'Cycle 2', grades: 'Grades 5-8', ages: 'Ages 10-14' },
    { id: 'high-school', name: 'High School', cycle: 'Cycle 3', grades: 'Grades 9-12', ages: 'Ages 14-18' }
  ],
  
  aiStrands: [
    { 
      id: 'strand-1', 
      name: 'Fundamentals of AI', 
      shortName: 'Fundamentals', 
      code: 'S1',
      definition: 'Core concepts and principles of artificial intelligence, including machine learning basics, neural networks, and AI system components.'
    },
    { 
      id: 'strand-2', 
      name: 'Data & Algorithms', 
      shortName: 'Data & Algorithms', 
      code: 'S2',
      definition: 'Understanding data collection, processing, analysis, and algorithmic thinking essential for AI development and implementation.'
    },
    { 
      id: 'strand-3', 
      name: 'AI Software Tools', 
      shortName: 'Software Tools', 
      code: 'S3',
      definition: 'Hands-on experience with AI development platforms, programming languages, and software tools used in AI applications.'
    },
    { 
      id: 'strand-4', 
      name: 'Ethical Awareness', 
      shortName: 'Ethics', 
      code: 'S4',
      definition: 'Understanding ethical implications, bias, fairness, and responsible AI development and deployment practices.'
    },
    { 
      id: 'strand-5', 
      name: 'Real-World Applications', 
      shortName: 'Applications', 
      code: 'S5',
      definition: 'Exploring AI applications across various industries and domains, understanding practical implementations and use cases.'
    },
    { 
      id: 'strand-6', 
      name: 'Innovation & Projects', 
      shortName: 'Innovation', 
      code: 'S6',
      definition: 'Creative problem-solving, project-based learning, and innovation methodologies applied to AI development.'
    },
    { 
      id: 'strand-7', 
      name: 'Society & Policy', 
      shortName: 'Society & Policy', 
      code: 'S7',
      definition: 'Understanding AI\'s impact on society, policy considerations, governance, and future implications of AI technology.'
    }
  ],

  grades: [
    {
      id: 'pre-k',
      name: 'Pre-K',
      gradeBandId: 'early-years',
      weeklyHours: 2,
      annualHours: 72,
      projectTimePercent: 60,
      assessmentTimePercent: 10,
      aiStrandsCoverage: {
        'strand-1': 30, 'strand-2': 10, 'strand-3': 25, 'strand-4': 15,
        'strand-5': 15, 'strand-6': 5, 'strand-7': 0
      },
      yearTheme: 'AI as Helper Friends',
      essentialQuestion: 'How do smart helpers make our world better?',
      competencies: {
        term1: ['Recognize AI helpers in daily life', 'Understand basic input-output concepts'],
        term2: ['Explore AI tools through play', 'Develop digital citizenship basics'],
        term3: ['Create simple AI-assisted projects', 'Reflect on AI experiences']
      },
      resources: {
        studentBook: 'AI Adventures for Little Learners',
        teacherGuide: 'Pre-K AI Teaching Guide'
      },
      lessons: [
        {
          id: 'lesson-1',
          title: 'Meet AI Helpers',
          description: 'Introduction to AI helpers in daily life',
          activities: [
            {
              id: 'activity-1',
              title: 'AI Helper Hunt',
              type: 'classroom',
              duration: 30,
              description: 'Identify AI helpers around us',
              aiStrands: ['strand-1', 'strand-5'],
              unescoCompetencies: ['u1-k1', 'u1-s1']
            }
          ]
        }
      ]
    },
    {
      id: 'kindergarten',
      name: 'Kindergarten',
      gradeBandId: 'early-years',
      weeklyHours: 3,
      annualHours: 108,
      projectTimePercent: 55,
      assessmentTimePercent: 15,
      aiStrandsCoverage: {
        'strand-1': 25, 'strand-2': 15, 'strand-3': 25, 'strand-4': 15,
        'strand-5': 15, 'strand-6': 5, 'strand-7': 0
      },
      yearTheme: 'Smart Technology Around Us',
      essentialQuestion: 'How does technology learn and help us?',
      competencies: {
        term1: ['Identify AI in everyday devices', 'Understand pattern recognition'],
        term2: ['Use age-appropriate AI tools', 'Practice responsible technology use'],
        term3: ['Design solutions with AI help', 'Share learning about smart technology']
      },
      resources: {
        studentBook: 'Smart Technology for Kindergarten',
        teacherGuide: 'Kindergarten AI Teaching Guide'
      },
      lessons: []
    },
    {
      id: 'grade-1',
      name: 'Grade 1',
      gradeBandId: 'elementary',
      weeklyHours: 3,
      annualHours: 108,
      projectTimePercent: 50,
      assessmentTimePercent: 15,
      aiStrandsCoverage: {
        'strand-1': 25, 'strand-2': 15, 'strand-3': 25, 'strand-4': 15,
        'strand-5': 15, 'strand-6': 5, 'strand-7': 0
      },
      yearTheme: 'AI Learning Partners',
      essentialQuestion: 'How can AI help me learn better?',
      competencies: {
        term1: ['Explore AI learning tools', 'Understand AI feedback'],
        term2: ['Create with AI assistance', 'Practice digital responsibility'],
        term3: ['Build simple AI projects', 'Reflect on AI learning experiences']
      },
      resources: {
        studentBook: 'AI Learning Partners - Grade 1',
        teacherGuide: 'Grade 1 AI Teaching Guide'
      },
      lessons: []
    },
    {
      id: 'grade-5',
      name: 'Grade 5',
      gradeBandId: 'middle-school',
      weeklyHours: 4,
      annualHours: 144,
      projectTimePercent: 45,
      assessmentTimePercent: 20,
      aiStrandsCoverage: {
        'strand-1': 20, 'strand-2': 20, 'strand-3': 20, 'strand-4': 15,
        'strand-5': 15, 'strand-6': 10, 'strand-7': 0
      },
      yearTheme: 'AI Systems and Data',
      essentialQuestion: 'How do AI systems process and learn from data?',
      competencies: {
        term1: ['Understand machine learning basics', 'Explore data collection and analysis'],
        term2: ['Design AI-powered solutions', 'Evaluate AI system performance'],
        term3: ['Create data-driven projects', 'Assess ethical implications of AI decisions']
      },
      resources: {
        studentBook: 'AI Systems and Data - Grade 5',
        teacherGuide: 'Grade 5 AI Teaching Guide'
      },
      lessons: []
    },
    {
      id: 'grade-9',
      name: 'Grade 9',
      gradeBandId: 'high-school',
      weeklyHours: 5,
      annualHours: 180,
      projectTimePercent: 40,
      assessmentTimePercent: 25,
      aiStrandsCoverage: {
        'strand-1': 15, 'strand-2': 25, 'strand-3': 20, 'strand-4': 15,
        'strand-5': 15, 'strand-6': 10, 'strand-7': 0
      },
      yearTheme: 'AI Innovation and Ethics',
      essentialQuestion: 'How can we innovate responsibly with AI technology?',
      competencies: {
        term1: ['Analyze AI algorithms and architectures', 'Develop ethical AI frameworks'],
        term2: ['Design complex AI applications', 'Implement responsible AI practices'],
        term3: ['Create innovative AI solutions', 'Evaluate societal impacts of AI technology']
      },
      resources: {
        studentBook: 'AI Innovation and Ethics - Grade 9',
        teacherGuide: 'Grade 9 AI Teaching Guide'
      },
      lessons: []
    },
  ],

  learningProgressionIndicators: [
    {
      id: 'lpi-early-years-strand-1',
      gradeBandId: 'early-years',
      strandId: 'strand-1',
      indicators: [
        'Recognize that computers can learn and make decisions',
        'Identify AI helpers in their environment (voice assistants, smart toys)',
        'Understand that AI needs examples to learn',
        'Demonstrate basic input-output understanding'
      ]
    },
    {
      id: 'lpi-early-years-strand-2',
      gradeBandId: 'early-years',
      strandId: 'strand-2',
      indicators: [
        'Recognize patterns in simple data sets',
        'Sort and categorize information',
        'Understand that computers follow instructions',
        'Identify simple algorithms in daily routines'
      ]
    },
    {
      id: 'lpi-elementary-strand-1',
      gradeBandId: 'elementary',
      strandId: 'strand-1',
      indicators: [
        'Explain basic AI concepts using age-appropriate language',
        'Compare human and machine learning processes',
        'Identify different types of AI applications',
        'Understand the role of training data in AI systems'
      ]
    },
    {
      id: 'lpi-middle-school-strand-1',
      gradeBandId: 'middle-school',
      strandId: 'strand-1',
      indicators: [
        'Define machine learning and its applications',
        'Explain neural networks using analogies',
        'Compare supervised and unsupervised learning',
        'Analyze the performance of AI systems'
      ]
    },
    {
      id: 'lpi-high-school-strand-1',
      gradeBandId: 'high-school',
      strandId: 'strand-1',
      indicators: [
        'Analyze complex AI algorithms and architectures',
        'Evaluate different machine learning approaches',
        'Design AI system architectures for specific problems',
        'Implement and optimize AI models'
      ]
    }
  ],

  crossCuttingCompetencies: [
    {
      id: 'cc-early-years-computational',
      gradeBandId: 'early-years',
      component: 'computational-thinking',
      progression: [
        'Pattern recognition in simple contexts',
        'Basic sequencing and ordering',
        'Simple problem decomposition',
        'Introduction to logical thinking'
      ]
    },
    {
      id: 'cc-early-years-ethical',
      gradeBandId: 'early-years',
      component: 'ethical-development',
      progression: [
        'Understanding fairness and sharing',
        'Recognizing helpful vs harmful technology',
        'Basic privacy concepts',
        'Respectful technology use'
      ]
    },
    {
      id: 'cc-elementary-computational',
      gradeBandId: 'elementary',
      component: 'computational-thinking',
      progression: [
        'Advanced pattern recognition',
        'Algorithm design and implementation',
        'Complex problem decomposition',
        'Debugging and iteration skills'
      ]
    },
    {
      id: 'cc-elementary-innovation',
      gradeBandId: 'elementary',
      component: 'innovation-skills',
      progression: [
        'Creative problem-solving approaches',
        'Design thinking methodology',
        'Collaboration in innovation projects',
        'Presenting innovative solutions'
      ]
    },
    {
      id: 'cc-middle-school-technical',
      gradeBandId: 'middle-school',
      component: 'technical-skills',
      progression: [
        'Programming fundamentals',
        'Data analysis and visualization',
        'AI tool proficiency',
        'System design basics'
      ]
    },
    {
      id: 'cc-high-school-ethical',
      gradeBandId: 'high-school',
      component: 'ethical-development',
      progression: [
        'Advanced ethical frameworks for AI',
        'Bias detection and mitigation',
        'AI governance and policy analysis',
        'Responsible AI development practices'
      ]
    }
  ],

  unescoCompetencies: [
    // Level 1: Understand
    { 
      id: '4.1.1', 
      code: '4.1.1', 
      level: 1, 
      levelName: 'Understand', 
      aspect: 'human-centred', 
      aspectName: 'Human-centred mindset', 
      title: 'Human agency', 
      description: 'Students recognize AI as human-led and shaped by human decisions.',
      curricularGoals: [
        'CG4.1.1.1: Guide students to see AI as a human-led life cycle.',
        'CG4.1.1.2: Explain why maintaining sufficient human control over AI is essential.',
        'CG4.1.1.3: Encourage critical reflection on human vs. machine agency.'
      ]
    },
    { 
      id: '4.1.4', 
      code: '4.1.4', 
      level: 1, 
      levelName: 'Understand', 
      aspect: 'human-centred', 
      aspectName: 'Human-centred mindset', 
      title: 'Problem scoping', 
      description: 'Students learn to define problems and decide when AI should/should not be applied.',
      curricularGoals: [
        'CG4.1.4.1: Foster critical thinking on when not to use AI.',
        'CG4.1.4.2: Develop skills in scoping a problem for AI.',
        'CG4.1.4.3: Assess requirements of AI systems (data, algorithms, computing resources).'
      ]
    },
    { 
      id: '4.2.1', 
      code: '4.2.1', 
      level: 1, 
      levelName: 'Understand', 
      aspect: 'ethics', 
      aspectName: 'Ethics of AI', 
      title: 'Embodied ethics', 
      description: 'Students recognize ethical principles in AI and their relevance to rights, fairness, and inclusion.',
      curricularGoals: [
        'CG4.2.1.1: Guide reflection on AI\'s ethical implications for human rights, privacy, inclusion.',
        'CG4.2.1.2: Nurture internalization of ethical values in practice.'
      ]
    },
    { 
      id: '4.3.1', 
      code: '4.3.1', 
      level: 1, 
      levelName: 'Understand', 
      aspect: 'techniques', 
      aspectName: 'AI Techniques & Applications', 
      title: 'AI foundations', 
      description: 'Students acquire knowledge of AI basics, especially data and algorithms.',
      curricularGoals: [
        'CG4.3.1.1: Build interdisciplinary foundations (math, statistics, computing).',
        'CG4.3.1.2: Relate these foundations to STEM, social sciences, and daily life.'
      ]
    },
    
    // Level 2: Apply
    { 
      id: '4.1.2', 
      code: '4.1.2', 
      level: 2, 
      levelName: 'Apply', 
      aspect: 'human-centred', 
      aspectName: 'Human-centred mindset', 
      title: 'Human accountability', 
      description: 'Students understand that accountability lies with AI creators and users.',
      curricularGoals: [
        'CG4.1.2.1: Explain human accountability as a legal obligation of AI creators/providers.',
        'CG4.1.2.2: Develop guidelines for accountability.',
        'CG4.1.2.3: Encourage reflection on ethical principles tied to accountability.'
      ]
    },
    { 
      id: '4.2.2', 
      code: '4.2.2', 
      level: 2, 
      levelName: 'Apply', 
      aspect: 'ethics', 
      aspectName: 'Ethics of AI', 
      title: 'Safe and responsible use', 
      description: 'Students use AI responsibly, ensuring privacy and security.',
      curricularGoals: [
        'CG4.2.2.1: Teach data protection and online safety.',
        'CG4.2.2.2: Encourage recognition of misuse risks and mitigation practices.'
      ]
    },
    { 
      id: '4.3.2', 
      code: '4.3.2', 
      level: 2, 
      levelName: 'Apply', 
      aspect: 'techniques', 
      aspectName: 'AI Techniques & Applications', 
      title: 'Application skills', 
      description: 'Students apply AI tools to real-world problems.',
      curricularGoals: [
        'CG4.3.2.1: Train students to run simulations and apply AI models.',
        'CG4.3.2.2: Evaluate applications for ethical soundness and effectiveness.'
      ]
    },
    { 
      id: '4.4.2', 
      code: '4.4.2', 
      level: 2, 
      levelName: 'Apply', 
      aspect: 'system-design', 
      aspectName: 'AI System Design', 
      title: 'Architecture design', 
      description: 'Students learn to configure system architecture for AI.',
      curricularGoals: [
        'CG4.4.2.1: Simulate evaluation of frameworks (e.g. TensorFlow, PyTorch).',
        'CG4.4.2.2: Guide project management including balancing resources and evaluating impacts.'
      ]
    },
    
    // Level 3: Create
    { 
      id: '4.1.3', 
      code: '4.1.3', 
      level: 3, 
      levelName: 'Create', 
      aspect: 'human-centred', 
      aspectName: 'Human-centred mindset', 
      title: 'Citizenship in the era of AI', 
      description: 'Students act as informed digital citizens in AI societies.',
      curricularGoals: [
        'CG4.1.3.1: Exemplify scope of AI with real cases (healthcare, finance, etc.).',
        'CG4.1.3.2: Promote equity in AI development.',
        'CG4.1.3.3: Foster sustainability in AI applications.',
        'CG4.1.3.4: Encourage inclusive AI development.'
      ]
    },
    { 
      id: '4.2.3', 
      code: '4.2.3', 
      level: 3, 
      levelName: 'Create', 
      aspect: 'ethics', 
      aspectName: 'Ethics of AI', 
      title: 'Ethics by design', 
      description: 'Students embed ethics into AI design and tools.',
      curricularGoals: [
        'CG4.2.3.1: Teach embedding fairness and transparency in design.',
        'CG4.2.3.2: Critically evaluate tools against ethical safeguards.'
      ]
    },
    { 
      id: '4.3.3', 
      code: '4.3.3', 
      level: 3, 
      levelName: 'Create', 
      aspect: 'techniques', 
      aspectName: 'AI Techniques & Applications', 
      title: 'Creating AI tools', 
      description: 'Students develop prototypes and simple AI tools.',
      curricularGoals: [
        'CG4.3.3.1: Use open-source platforms to build prototypes.',
        'CG4.3.3.2: Evaluate functionality and ethical impact.'
      ]
    },
    { 
      id: '4.4.3', 
      code: '4.4.3', 
      level: 3, 
      levelName: 'Create', 
      aspect: 'system-design', 
      aspectName: 'AI System Design', 
      title: 'Iteration & feedback loops', 
      description: 'Students iterate on AI systems through testing and ethical reflection.',
      curricularGoals: [
        'CG4.4.3.1: Train on iterative model improvements.',
        'CG4.4.3.2: Incorporate feedback from users.',
        'CG4.4.3.3: Ensure redesign aligns with ethics and human-centred goals.'
      ]
    }
  ]
};