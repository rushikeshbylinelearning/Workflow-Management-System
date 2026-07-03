import React from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { 
  Sparkles, 
  Brain, 
  Users, 
  Shield, 
  TrendingUp, 
  BookOpen, 
  Lightbulb, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  Star,
  ArrowRight,
  Globe,
  Zap,
  Award,
  Clock,
  Layers,
  Rocket,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  ExternalLink,
  Heart
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { isAdminMode } = useCurriculum();
  const [editingSection, setEditingSection] = React.useState<string | null>(null);
  const [selectedModal, setSelectedModal] = React.useState<any>(null);
  const [featureData, setFeatureData] = React.useState([
    {
      icon: Brain,
      title: 'AI-Powered Learning',
      description: 'Comprehensive curriculum covering all aspects of artificial intelligence education',
      color: 'bg-blue-500',
      content: 'Our AI-powered learning approach integrates cutting-edge technology with proven pedagogical methods to create an immersive educational experience.',
      link: 'https://example.com/ai-learning'
    },
    {
      icon: Users,
      title: 'Teacher Support',
      description: 'Professional development and resources to empower educators',
      color: 'bg-green-500',
      content: 'Comprehensive teacher support including training programs, resource libraries, and ongoing professional development opportunities.',
      link: 'https://example.com/teacher-support'
    },
    {
      icon: Shield,
      title: 'Safe Environment',
      description: 'Secure emulators and guided simulations for hands-on learning',
      color: 'bg-purple-500',
      content: 'Our secure learning environment ensures student safety while providing hands-on experience with AI technologies.',
      link: 'https://example.com/safe-environment'
    },
    {
      icon: Target,
      title: 'Standards Aligned',
      description: 'Curriculum aligned with educational standards and best practices',
      color: 'bg-orange-500',
      content: 'Fully aligned with international educational standards and UNESCO AI competency framework.',
      link: 'https://example.com/standards'
    }
  ]);

  const saveFeature = (index: number, updatedFeature: any) => {
    const updatedFeatures = [...featureData];
    updatedFeatures[index] = updatedFeature;
    setFeatureData(updatedFeatures);
    setEditingSection(null);
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative px-8 py-16 text-center text-white">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-white bg-opacity-20 rounded-2xl backdrop-blur-sm">
              <Sparkles className="w-16 h-16" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">KODEIT NOVA</h1>
          <p className="text-2xl font-light mb-2">AI Curriculum Design Platform</p>
          <p className="text-lg opacity-90 max-w-3xl mx-auto leading-relaxed">
            Empowering educators with comprehensive AI curriculum from Pre-K to Grade 12, 
            built on proven pedagogical frameworks and cutting-edge educational technology.
          </p>
          <div className="mt-8 flex items-center justify-center space-x-4">
            <div className="px-4 py-2 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
              <span className="text-sm font-medium">Pre-K to Grade 12</span>
            </div>
            <div className="px-4 py-2 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
              <span className="text-sm font-medium">7 AI Strands</span>
            </div>
            <div className="px-4 py-2 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
              <span className="text-sm font-medium">Research-Based</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {featureData.map((feature, index) => {
          const Icon = feature.icon;
          const isEditing = editingSection === `feature-${index}`;
          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all relative group">
              {isAdminMode && !isEditing && (
                <button
                  onClick={() => setEditingSection(`feature-${index}`)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              {isEditing && (
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button
                    onClick={() => saveFeature(index, feature)}
                    className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-all"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingSection(null)}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className={`p-3 ${feature.color} rounded-lg w-fit mb-4`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              {isEditing ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={feature.title}
                    onChange={(e) => {
                      const updatedFeatures = [...featureData];
                      updatedFeatures[index] = { ...feature, title: e.target.value };
                      setFeatureData(updatedFeatures);
                    }}
                    className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b border-blue-500 focus:outline-none"
                    placeholder="Feature title"
                  />
                  <textarea
                    value={feature.description}
                    onChange={(e) => {
                      const updatedFeatures = [...featureData];
                      updatedFeatures[index] = { ...feature, description: e.target.value };
                      setFeatureData(updatedFeatures);
                    }}
                    rows={3}
                    className="w-full text-gray-600 text-sm bg-transparent border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Feature description"
                  />
                  <textarea
                    value={feature.content}
                    onChange={(e) => {
                      const updatedFeatures = [...featureData];
                      updatedFeatures[index] = { ...feature, content: e.target.value };
                      setFeatureData(updatedFeatures);
                    }}
                    rows={3}
                    className="w-full text-gray-600 text-sm bg-transparent border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Detailed content for modal"
                  />
                  <input
                    type="url"
                    value={feature.link}
                    onChange={(e) => {
                      const updatedFeatures = [...featureData];
                      updatedFeatures[index] = { ...feature, link: e.target.value };
                      setFeatureData(updatedFeatures);
                    }}
                    className="w-full text-gray-600 text-sm bg-transparent border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="External link (optional)"
                  />
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-3">{feature.description}</p>
                  <button 
                    onClick={() => setSelectedModal(feature)}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <span>Learn more</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* UNESCO AI Framework Highlight */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <Globe className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Built on UNESCO AI Competency Framework</h2>
              <p className="text-lg opacity-90">
                The only curriculum platform officially aligned with UNESCO's global AI education standards
              </p>
              <div className="mt-4 flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span>Level 1: Understand</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span>Level 2: Apply</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                  <span>Level 3: Create</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <span>4 Key Aspects</span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">16</div>
            <div className="text-sm opacity-75">Core Competencies</div>
            <div className="text-lg font-medium mt-2">4 Key Aspects</div>
            <div className="text-sm opacity-75 mt-1">Global Standards</div>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Brain, title: 'Human-centred mindset', desc: 'AI as human-led technology' },
            { icon: Shield, title: 'Ethics of AI', desc: 'Responsible AI practices' },
            { icon: Target, title: 'AI Techniques', desc: 'Technical knowledge & skills' },
            { icon: Heart, title: 'System Design', desc: 'Human-centred AI systems' }
          ].map((aspect, index) => {
            const Icon = aspect.icon;
            return (
              <div key={index} className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur-sm">
                <Icon className="w-6 h-6 mb-2" />
                <h3 className="font-semibold text-sm mb-1">{aspect.title}</h3>
                <p className="text-xs opacity-80">{aspect.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instructional Modalities */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Pedagogical Framework</h2>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Our curriculum is built on proven educational theories and methodologies, 
            ensuring effective learning outcomes for all students.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Layers,
              title: 'Constructivism',
              description: 'Students build knowledge through hands-on experiences and reflection',
              color: 'border-blue-200 bg-blue-50'
            },
            {
              icon: TrendingUp,
              title: 'Progressive Learning',
              description: 'Curriculum advances from concrete to abstract concepts systematically',
              color: 'border-green-200 bg-green-50'
            },
            {
              icon: Rocket,
              title: 'Spiral Curriculum',
              description: 'Key concepts revisited with increasing complexity and depth',
              color: 'border-purple-200 bg-purple-50'
            },
            {
              icon: Zap,
              title: 'Scaffolding',
              description: 'Structured support that gradually builds student independence',
              color: 'border-orange-200 bg-orange-50'
            }
          ].map((modality, index) => {
            const Icon = modality.icon;
            return (
              <div key={index} className={`border-2 rounded-lg p-6 ${modality.color} hover:shadow-md transition-all`}>
                <Icon className="w-8 h-8 text-gray-700 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{modality.title}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{modality.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Latest News & Announcements */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-8">
        <div className="flex items-center justify-between mb-6 relative">
          {isAdminMode && (
            <button
              onClick={() => setEditingSection('news')}
              className="absolute -top-2 -right-2 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">AI in Education News</h2>
          </div>
          <span className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-full">Latest Updates</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              date: 'January 2025',
              title: 'UNESCO AI Education Guidelines Released',
              summary: 'New international standards for AI literacy in K-12 education',
              tag: 'Policy'
            },
            {
              date: 'December 2024',
              title: 'AI Safety in Schools Initiative',
              summary: 'Major tech companies collaborate on educational AI safety protocols',
              tag: 'Safety'
            },
            {
              date: 'November 2024',
              title: 'Teacher AI Training Programs Expand',
              summary: 'Professional development opportunities reach 10,000+ educators',
              tag: 'Training'
            }
          ].map((news, index) => (
            <div key={index} className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">{news.date}</span>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">{news.tag}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{news.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{news.summary}</p>
              <button 
                onClick={() => setSelectedModal(news)}
                className="mt-3 flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                <span>Read more</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Risks Section */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-red-600 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Risks of Inadequate AI Education</h2>
            <p className="text-gray-600 mt-1">The critical consequences of not preparing students for an AI-driven world</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Users,
              title: 'Workforce Unpreparedness',
              description: 'Students lack essential AI skills for future careers',
              impact: '85% of jobs by 2030 will require AI literacy',
              color: 'bg-red-100 border-red-200'
            },
            {
              icon: Brain,
              title: 'Critical Thinking Gap',
              description: 'Inability to evaluate AI systems and outputs critically',
              impact: 'Leads to blind acceptance of AI-generated content',
              color: 'bg-orange-100 border-orange-200'
            },
            {
              icon: Shield,
              title: 'Bias Blindness',
              description: 'Cannot identify or address AI bias and discrimination',
              impact: 'Perpetuates social inequalities and unfair systems',
              color: 'bg-yellow-100 border-yellow-200'
            },
            {
              icon: Heart,
              title: 'Ethical Vacuum',
              description: 'Missing moral frameworks for AI decision-making',
              impact: 'Unethical AI use without understanding consequences',
              color: 'bg-purple-100 border-purple-200'
            },
            {
              icon: TrendingUp,
              title: 'Digital Divide',
              description: 'Unequal access to AI education creates disparities',
              impact: 'Widens socioeconomic gaps in opportunities',
              color: 'bg-blue-100 border-blue-200'
            },
            {
              icon: Globe,
              title: 'Misinformation Vulnerability',
              description: 'Susceptible to AI-generated fake content and deepfakes',
              impact: 'Undermines democratic processes and social trust',
              color: 'bg-green-100 border-green-200'
            }
          ].map((risk, index) => {
            const Icon = risk.icon;
            return (
              <div key={index} className={`${risk.color} border-2 rounded-lg p-6 hover:shadow-md transition-all`}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-red-600 rounded-lg">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{risk.title}</h3>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-3">{risk.description}</p>
                <div className="p-3 bg-white bg-opacity-60 rounded border border-red-200">
                  <p className="text-xs font-medium text-red-800 flex items-center space-x-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Impact: {risk.impact}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 p-6 bg-white rounded-lg border-2 border-red-300">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-600 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">KODEIT NOVA Addresses These Risks</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>UNESCO-aligned curriculum ensures global standards</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>Critical thinking embedded in every lesson</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>Bias detection and ethical reasoning training</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>Comprehensive teacher professional development</span>
            </div>
          </div>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-green-600 rounded-xl">
              <Award className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose KODEIT NOVA?</h2>
          <p className="text-gray-700 max-w-2xl mx-auto">
            We bring unparalleled expertise and comprehensive solutions to AI education
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: CheckCircle,
              title: 'Research-Based',
              description: 'Curriculum grounded in educational research and best practices',
              stats: '50+ Studies'
            },
            {
              icon: Users,
              title: 'Expert Team',
              description: 'Developed by AI researchers, educators, and curriculum specialists',
              stats: '20+ Experts'
            },
            {
              icon: Globe,
              title: 'Global Reach',
              description: 'Implemented in schools across multiple countries and contexts',
              stats: '100+ Schools'
            },
            {
              icon: Clock,
              title: 'Proven Results',
              description: 'Demonstrated improvement in student AI literacy and engagement',
              stats: '95% Success'
            },
            {
              icon: Shield,
              title: 'Safety First',
              description: 'Comprehensive safety protocols and age-appropriate content',
              stats: '100% Secure'
            },
            {
              icon: Rocket,
              title: 'Future Ready',
              description: 'Preparing students for careers in the AI-driven economy',
              stats: '2030+ Ready'
            }
          ].map((value, index) => {
            const Icon = value.icon;
            return (
              <div key={index} className="bg-white rounded-lg p-6 border border-green-200 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Icon className="w-8 h-8 text-green-600" />
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                    {value.stats}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{value.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Call to Action */}
      <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative px-8 py-16 text-center text-white">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="p-4 bg-white bg-opacity-20 rounded-2xl backdrop-blur-sm">
                <Brain className="w-16 h-16" />
              </div>
              <div className="absolute -top-2 -right-2 p-2 bg-yellow-400 rounded-full">
                <Globe className="w-6 h-6 text-blue-900" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">KODEIT NOVA</span>
          </h1>
          <p className="text-2xl font-light mb-2">UNESCO-Aligned AI Curriculum Platform</p>
          <h2 className="text-3xl font-bold mb-4">Ready to Transform AI Education?</h2>
          <p className="text-lg opacity-90 max-w-3xl mx-auto leading-relaxed">
            The world's first comprehensive AI curriculum platform built on the official UNESCO AI Competency Framework, 
            empowering educators to prepare students for the AI-driven future with confidence and expertise.
          </p>
          <div className="mt-8 flex items-center justify-center space-x-4">
            <button className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Get Started Today
            </button>
            <button className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition-colors">
              Schedule Demo
            </button>
          </div>
        </div>
      </div>

      {/* Modal for Read More */}
      {selectedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedModal.title}</h2>
                <button
                  onClick={() => setSelectedModal(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                {selectedModal.date && (
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{selectedModal.date}</span>
                    {selectedModal.tag && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">{selectedModal.tag}</span>
                    )}
                  </div>
                )}
                <p className="text-gray-700 leading-relaxed">{selectedModal.summary || selectedModal.description}</p>
                <div className="text-gray-700 leading-relaxed">
                  <p>{selectedModal.content}</p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      {selectedModal.link && (
                        <a
                          href={selectedModal.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mr-3"
                        >
                          <span>Learn More</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedModal(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};