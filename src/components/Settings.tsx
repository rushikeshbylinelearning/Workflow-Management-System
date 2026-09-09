import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Settings as SettingsIcon,
  Tag,
  Users,
  Layers,
  Save,
  X,
  UserPlus,
  Key,
  Mail,
  Eye,
  EyeOff,
  BarChart3,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

import { useAuth } from '../contexts/AuthContext';
import { teamService, categoryService, skillService, stageService, stageTemplateService } from '../services/apiService';
import { AccessManagement } from './AccessManagement';
import { ApiKeyManager } from './ApiKeyManager';
import { AdminAuditManagement } from './AdminAuditManagement';

interface Stage {
  id: string;
  name: string;
  description: string;
  order_index: number;
  is_active: boolean;
  template_order?: number;
  is_default?: boolean;
  category?: string; // Optional category assignment
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<'categories' | 'skills' | 'stages' | 'users' | 'functional-units' | 'access-management' | 'api-keys' | 'admin-audit'>('categories');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('eLearning Design');

  // Function to load stages for a category
  const loadStagesForCategory = async (categoryName: string) => {
    try {
      setStagesLoading(true);
      const category = categories.find((c: any) => c.name === categoryName);
      if (category) {
        const stagesData = await stageService.getByCategory(category.id);
        setStages(stagesData);
      }
    } catch (error) {
      console.error('Failed to load stages for category:', error);
      setStages([]); // Set empty array on error
    } finally {
      setStagesLoading(false);
    }
  };
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [userType, setUserType] = useState<'admin' | 'team'>('admin');
  const [categories, setCategories] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [functionalUnits, setFunctionalUnits] = useState<any[]>([
    {
      id: '1',
      name: 'Content Development Unit',
      description: 'Responsible for creating and developing educational content',
      skills: ['Content Writers', 'Instructional Designers'],
      lead: 'Sarah Johnson',
      isDefault: true
    }
  ]);
  const { signUp } = useAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const { showToast } = useToast();

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load categories and skills from backend
        const [categoriesData, skillsData] = await Promise.all([
          categoryService.getAll(),
          skillService.getAll()
        ]);
        
        setCategories(categoriesData);
        setSkills(skillsData);
        
        // Set default selected category if available
        if (categoriesData.length > 0) {
          const categoryExists = categoriesData.find((c: any) => c.name === selectedCategory);
          if (!categoryExists) {
            setSelectedCategory(categoriesData[0].name);
          }
        }
        
        // Load stages for the selected category
        if (categoriesData.length > 0) {
          const selectedCategoryId = categoriesData.find((c: any) => c.name === selectedCategory)?.id;
          if (selectedCategoryId) {
            const stagesData = await stageService.getByCategory(selectedCategoryId);
            setStages(stagesData);
          }
        }
        
        // Load admin users (in a real app, you would fetch from Supabase auth)
        setAdminUsers([
          { id: '1', name: 'Admin User', email: 'admin@company.com', role: 'admin', createdAt: new Date(), isActive: true }
        ]);
        
        // Load team members from database
        const members = await teamService.getAll();
        setTeamMembers(members);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedCategory]);

  const tabs = [
    { key: 'categories', label: 'Categories', icon: Tag },
    { key: 'skills', label: 'Skills', icon: Users },
    { key: 'stages', label: 'Project Stages', icon: Layers },
    { key: 'access-management', label: 'Access Management', icon: Shield },
    { key: 'api-keys', label: 'API Keys', icon: Key },
    { key: 'admin-audit', label: 'Audit Management', icon: BarChart3 },
  ];

  const handleAddItem = async (type: string, data: any) => {
    try {
      if (type === 'category') {
        if (editingItem?.id) {
          // Update existing category
          const updatedCategory = await categoryService.update(editingItem.id, { 
            name: data.name,
            description: data.description || null
          });
          setCategories(categories.map(c => c.id === editingItem.id ? updatedCategory : c));
        } else {
          // Create new category
          const newCategory = await categoryService.create({ 
            name: data.name,
            description: data.description || null
          });
          setCategories([...categories, newCategory]);
        }
      } else if (type === 'skill') {
        if (editingItem?.id) {
          // Update existing skill
          const updatedSkill = await skillService.update(editingItem.id, { 
            name: data.name,
            description: data.description || null
          });
          setSkills(skills.map(s => s.id === editingItem.id ? updatedSkill : s));
        } else {
          // Create new skill
          const newSkill = await skillService.create({ 
            name: data.name,
            description: data.description || null
          });
          setSkills([...skills, newSkill]);
        }
            } else if (type === 'stage') {
        try {
          if (editingItem?.id) {
            // Update existing stage
            const updatedStage = await stageService.update(editingItem.id, {
              name: data.name,
              description: data.description || null
            });
            
            // Reload stages to get the updated data
            await loadStagesForCategory(selectedCategory);
          } else {
            // Create new stage
            const newStage = await stageService.create({
              name: data.name,
              description: data.description || null,
              order_index: stages.length + 1
            });
            
            // Create stage template to link stage to category
            const selectedCategoryId = categories.find((c: any) => c.name === selectedCategory)?.id;
            if (selectedCategoryId) {
              await stageTemplateService.create({
                category_id: selectedCategoryId,
                stage_id: newStage.id,
                order_index: stages.length + 1,
                is_default: false
              });
            }
            
            // Reload stages to get the updated list with template data
            await loadStagesForCategory(selectedCategory);
            showToast(`Stage "${data.name}" added successfully!`, 'success');
          }
        } catch (error) {
          console.error('Failed to save stage:', error);
          showToast('Failed to save stage. Please try again.', 'error');
        }
      } else if (type === 'admin-user') {
        handleCreateUser(data, 'admin');
        return; // Don't close modal yet, let handleCreateUser handle it
      } else if (type === 'team-user') {
        handleCreateUser(data, 'team');
        return; // Don't close modal yet, let handleCreateAdminUser handle it
      } else if (type === 'functional-unit') {
        const newUnit = {
          id: Date.now().toString(),
          name: data.name,
          description: data.description || '',
          skills: data.skills || [],
          lead: data.lead || '',
          isDefault: false
        };
        setFunctionalUnits([...functionalUnits, newUnit]);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    }
  };

  const handleEditItem = async (type: string, item: any) => {
    if (type === 'category' || type === 'skill') {
      setEditingItem({ ...item, type });
      setIsModalOpen(true);
    } else {
      setEditingItem({ ...item, type });
      setIsModalOpen(true);
    }
  };

  const handleDeleteItem = async (type: string, id: string) => {
    try {
      if (type === 'category') {
        await categoryService.delete(id);
        setCategories(categories.filter(c => c.id !== id));
      } else if (type === 'skill') {
        await skillService.delete(id);
        setSkills(skills.filter(s => s.id !== id));
      } else if (type === 'stage') {
        try {
          // First, delete the stage template (if it exists)
          const selectedCategoryId = categories.find((c: any) => c.name === selectedCategory)?.id;
          if (selectedCategoryId) {
            try {
              // Get stage templates for this category and stage
              const templates = await stageTemplateService.getByCategory(selectedCategoryId);
              const templateToDelete = templates.find((t: any) => t.stage_id === id);
              if (templateToDelete) {
                await stageTemplateService.delete(templateToDelete.id);
              }
            } catch (error) {
            }
          }
          
          // Then delete the stage
          await stageService.delete(id);
          setStages(stages.filter(s => s.id !== id));
        } catch (error) {
          console.error('Failed to delete stage:', error);
          alert('Failed to delete stage. Please try again.');
        }
      } else if (type === 'admin-user') {
        setAdminUsers(adminUsers.filter(u => u.id !== id));
      } else if (type === 'team-user') {
        handleDeleteTeamMember(id);
      } else if (type === 'functional-unit') {
        setFunctionalUnits(functionalUnits.filter(u => u.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item. Please try again.');
    }
  };

  const handleCreateUser = async (userData: any, type: 'admin' | 'team') => {
    try {
      if (type === 'admin') {
        const { data, error } = await signUp(userData.email, userData.password, userData.name);
        
        if (error) {
          throw error;
        }

        if (data.user) {
          // Add to local state
          const newUser = {
            id: data.user.id,
            name: userData.name,
            email: userData.email,
            role: 'admin',
            createdAt: new Date(),
            isActive: true
          };
          setAdminUsers([...adminUsers, newUser]);
        }
      } else {
        // Create team member
        const newMemberData = {
          name: userData.name,
          email: userData.email,
          skills: userData.skills || [],
          passcode: userData.passcode || Math.random().toString(36).substring(2, 8).toUpperCase(),
          isActive: userData.isActive !== false,
          performanceFlags: [],
        };
        
        const createdMember = await teamService.create(newMemberData);
        const newMember = { ...newMemberData, id: createdMember.id };
        setTeamMembers([...teamMembers, newMember]);
      }
      
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error('Failed to create admin user:', error);
      // You might want to show an error message to the user here
      alert(`Failed to create user: ${error.message}`);
    }
  };

  const handleToggleUserAccess = async (userId: string, userType: 'admin' | 'team') => {
    try {
      if (userType === 'admin') {
        // For admin users, we can't directly disable Supabase auth users from client-side
        alert('Admin user access control requires server-side implementation');
        return;
      } else {
        // For team members, toggle the isActive status
        const member = teamMembers.find(m => m.id === userId);
        if (member) {
          const updatedMember = { ...member, isActive: !member.isActive };
          await teamService.update(userId, updatedMember);
          setTeamMembers(teamMembers.map(m => m.id === userId ? updatedMember : m));
        }
      }
    } catch (error) {
      console.error('Failed to toggle user access:', error);
      alert('Failed to toggle user access');
    }
  };

  const handleResetPassword = async (user: any, userType: 'admin' | 'team') => {
    setSelectedUser(user);
    setUserType(userType);
    setIsPasswordModalOpen(true);
  };

  const handleDeleteTeamMember = async (memberId: string) => {
    try {
      // In a real app, you would call teamService.delete(memberId)
      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Failed to delete team member:', error);
    }
  };

  const handlePasswordReset = async (newPassword: string) => {
    if (!selectedUser) return;

    try {
      if (userType === 'admin') {
        // For admin users, in a real app you would call Supabase auth admin API
        alert('Admin password reset functionality requires server-side implementation');
      } else {
        // For team members, update the passcode
        const updatedMember = { ...selectedUser, passcode: newPassword };
        await teamService.update(selectedUser.id, updatedMember);
        setTeamMembers(teamMembers.map(m => m.id === selectedUser.id ? updatedMember : m));
      }
      setIsPasswordModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to reset password:', error);
      alert('Failed to reset password');
    }
  };

  const moveStage = async (stageId: string, direction: 'up' | 'down') => {
    try {
      
      // Since we're already loading stages for the specific category, no need to filter
      const categoryStages = [...stages].sort((a, b) => (a.template_order || a.order_index) - (b.template_order || b.order_index));
      const stageIndex = categoryStages.findIndex(s => s.id === stageId);
      
      if (stageIndex === -1) {
        return;
      }

      const newCategoryStages = [...categoryStages];
      const targetIndex = direction === 'up' ? stageIndex - 1 : stageIndex + 1;

      if (targetIndex < 0 || targetIndex >= newCategoryStages.length) {
        return;
      }

      // Swap stages
      [newCategoryStages[stageIndex], newCategoryStages[targetIndex]] = [newCategoryStages[targetIndex], newCategoryStages[stageIndex]];
      
      // Update order numbers
      newCategoryStages.forEach((stage, index) => {
        stage.template_order = index + 1;
      });

      // Update the stages array
      setStages(newCategoryStages);

      // Save reordering to backend
      const selectedCategoryId = categories.find((c: any) => c.name === selectedCategory)?.id;
      if (selectedCategoryId) {
        const stageOrders = newCategoryStages.map((stage, index) => ({
          stage_id: stage.id,
          order: index + 1
        }));
        await stageService.reorder(selectedCategoryId, stageOrders);
      }
    } catch (error) {
      console.error('Failed to reorder stages:', error);
      alert('Failed to reorder stages. Please try again.');
    }
  };

  const renderCategories = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Project Categories</h3>
        <Button 
          icon={<Plus className="w-4 h-4" />} 
          onClick={() => {
            setEditingItem({ type: 'category' });
            setIsModalOpen(true);
          }}
        >
          Add Category
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading categories...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    <p className="text-sm text-gray-600">
                      {category.isDefault ? 'Default category' : 'Custom category'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditItem('category', category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {!category.isDefault && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteItem('category', category.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderSkills = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Team Skills</h3>
        <Button 
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingItem({ type: 'skill' });
            setIsModalOpen(true);
          }}
        >
          Add Skill
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading skills...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <Card key={skill.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{skill.name}</h4>
                    <p className="text-sm text-gray-600">
                      {skill.isDefault ? 'Default skill' : 'Custom skill'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditItem('skill', skill)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {!skill.isDefault && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteItem('skill', skill.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderStages = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Project Stages</h3>
        <div className="flex items-center space-x-4">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              loadStagesForCategory(e.target.value);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {categories.map(category => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
          <Button 
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingItem({ type: 'stage' });
              setIsModalOpen(true);
            }}
          >
            Add Stage
          </Button>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Category: {selectedCategory}</h4>
        <p className="text-sm text-blue-700">
          These stages are specific to <strong>{selectedCategory}</strong> projects. 
          Each category can have its own unique workflow.
        </p>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="space-y-2 p-4">
            {stagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading stages...</p>
                </div>
              </div>
            ) : stages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">
                  <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-900 mb-2">No stages found</p>
                  <p className="text-gray-600">No stages have been created for this category yet.</p>
                </div>
                <Button 
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setEditingItem({ type: 'stage' });
                    setIsModalOpen(true);
                  }}
                >
                  Add First Stage
                </Button>
              </div>
            ) : (
              stages
                .sort((a, b) => (a.template_order || a.order_index) - (b.template_order || b.order_index))
                .map((stage, index, filteredStages) => (
              <div key={stage.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveStage(stage.id, 'up')}
                      disabled={index === 0}
                      className="h-6 w-6 p-0"
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveStage(stage.id, 'down')}
                      disabled={index === filteredStages.length - 1}
                      className="h-6 w-6 p-0"
                    >
                      ↓
                    </Button>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                    {stage.template_order || stage.order_index}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{stage.name}</h4>
                    <p className="text-sm text-gray-600">{stage.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {stage.is_default && (
                    <Badge variant="secondary" size="sm">Default</Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditItem('stage', stage)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {!stage.is_default && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteItem('stage', stage.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <Button
              variant={userType === 'admin' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setUserType('admin')}
            >
              Admin Users
            </Button>
            <Button
              variant={userType === 'team' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setUserType('team')}
            >
              Team Members
            </Button>
          </div>
        </div>
        <Button 
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingItem({ type: userType === 'admin' ? 'admin-user' : 'team-user' });
            setIsModalOpen(true);
          }}
        >
          Add {userType === 'admin' ? 'Admin User' : 'Team Member'}
        </Button>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          {userType === 'admin' ? 'Admin User Management' : 'Team Member Management'}
        </h4>
        <p className="text-sm text-blue-700">
          {userType === 'admin' 
            ? 'Admin users can access the full project management system. They can manage projects, teams, tasks, and settings.'
            : 'Team members can access the team portal to view their tasks and performance. They use email and passcode to login.'
          }
        </p>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {userType === 'admin' ? 'Admin User' : 'Team Member'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  {userType === 'team' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passcode
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {userType === 'admin' ? 'Role' : 'Skills'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {userType === 'admin' ? 'Created' : 'Performance'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(userType === 'admin' ? adminUsers : teamMembers).map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${userType === 'admin' ? 'bg-blue-500' : 'bg-green-500'} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                    {userType === 'team' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {user.passcode}
                        </code>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {userType === 'admin' ? (
                        <Badge variant="primary" size="sm">{user.role}</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.skills?.slice(0, 2).map((skill: string, index: number) => (
                            <Badge key={index} variant="secondary" size="sm">
                              {skill}
                            </Badge>
                          ))}
                          {user.skills?.length > 2 && (
                            <Badge variant="secondary" size="sm">
                              +{user.skills.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Badge variant={user.isActive ? 'success' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {userType === 'admin' ? (
                        user.createdAt?.toLocaleDateString() || 'N/A'
                      ) : (
                        <div className="flex space-x-1">
                          {user.performanceFlags?.slice(0, 3).map((flag: any) => (
                            <div
                              key={flag.id}
                              className={`text-xs px-2 py-1 rounded ${
                                flag.type === 'gold' ? 'bg-yellow-500 text-white' :
                                flag.type === 'green' ? 'bg-green-500 text-white' :
                                flag.type === 'orange' ? 'bg-orange-500 text-white' :
                                'bg-red-500 text-white'
                              }`}
                              title={flag.reason}
                            >
                              {flag.type}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteItem('user', user.id)}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleResetPassword(user, userType)}
                          title={userType === 'admin' ? 'Reset Password' : 'Reset Passcode'}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleToggleUserAccess(user.id, userType)}
                          title={user.isActive ? 'Disable Access' : 'Enable Access'}
                        >
                          {user.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteItem(userType === 'admin' ? 'admin-user' : 'team-user', user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFunctionalUnits = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Functional Units</h3>
        <Button 
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingItem({ type: 'functional-unit' });
            setIsModalOpen(true);
          }}
        >
          Add Functional Unit
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {functionalUnits.map((unit) => (
          <Card key={unit.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{unit.name}</h4>
                  <p className="text-sm text-gray-600">{unit.description}</p>
                  {unit.skills && unit.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {unit.skills.map((skill: string, index: number) => (
                        <Badge key={index} variant="secondary" size="sm">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {unit.lead && (
                    <p className="text-xs text-gray-500 mt-1">Lead: {unit.lead}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditItem('functional-unit', unit)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {!unit.isDefault && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteItem('functional-unit', unit.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-white/80">Manage categories, skills, and project stages</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'categories' && renderCategories()}
        {activeTab === 'skills' && renderSkills()}
        {activeTab === 'stages' && renderStages()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'functional-units' && renderFunctionalUnits()}
        {activeTab === 'access-management' && <AccessManagement />}
        {activeTab === 'api-keys' && <ApiKeyManager />}
        {activeTab === 'admin-audit' && <AdminAuditManagement />}
      </div>

      {/* Add/Edit Modal */}
      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleAddItem}
        editingItem={editingItem}
      />
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: string, data: any) => void;
  editingItem: any;
}

function SettingsModal({ isOpen, onClose, onSubmit, editingItem }: SettingsModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    email: '',
    password: '',
    showPassword: false,
    skills: [] as string[],
    lead: '',
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name || '',
        description: editingItem.description || '',
        email: editingItem.email || '',
        password: '',
        showPassword: false,
        skills: editingItem.skills || [],
        lead: editingItem.lead || '',
      });
    } else {
      setFormData({ 
        name: '', 
        description: '', 
        email: '', 
        password: '', 
        showPassword: false,
        skills: [],
        lead: '',
      });
    }
  }, [editingItem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem?.type) {
      onSubmit(editingItem.type, formData);
    }
    setFormData({ 
      name: '', 
      description: '', 
      email: '', 
      password: '', 
      showPassword: false,
      skills: [],
      lead: '',
    });
  };

  const getModalTitle = () => {
    if (!editingItem) return 'Add Item';
    const action = editingItem.id ? 'Edit' : 'Add';
    const type = editingItem.type === 'category' ? 'Category' : 
                 editingItem.type === 'skill' ? 'Skill' : 
                 editingItem.type === 'stage' ? 'Stage' : 
                 editingItem.type === 'functional-unit' ? 'Functional Unit' : 'Admin User';
    return `${action} ${type}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getModalTitle()}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={`Enter ${editingItem?.type || 'item'} name`}
          />
        </div>

        {(editingItem?.type === 'admin-user' || editingItem?.type === 'team-user') && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={formData.showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {formData.showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {(editingItem?.type === 'stage' || editingItem?.type === 'functional-unit') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder={`Enter ${editingItem?.type === 'stage' ? 'stage' : 'functional unit'} description`}
            />
          </div>
        )}

        {editingItem?.type === 'functional-unit' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
                {['Content Writers', 'Instructional Designers', 'Graphic Designers', 'Developers', 'Animators', 'Tech', 'Sales', 'Marketing', 'QA'].map(skill => (
                  <label key={skill} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.skills.includes(skill)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, skills: [...formData.skills, skill] });
                        } else {
                          setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{skill}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Lead (Optional)
              </label>
              <input
                type="text"
                value={formData.lead}
                onChange={(e) => setFormData({ ...formData, lead: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter unit lead name"
              />
            </div>
          </>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {editingItem?.id ? 'Update' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  user: any;
  userType: 'admin' | 'team';
}

function PasswordResetModal({ isOpen, onClose, onSubmit, user, userType }: PasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (userType === 'team') {
        setNewPassword(Math.random().toString(36).substring(2, 8).toUpperCase());
      } else {
        setNewPassword('');
      }
    }
  }, [isOpen, userType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(newPassword);
    setNewPassword('');
  };

  const generateNewPasscode = () => {
    setNewPassword(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Reset ${userType === 'admin' ? 'Password' : 'Passcode'} for ${user?.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            {userType === 'admin' ? 'Reset Admin Password' : 'Reset Team Member Passcode'}
          </h4>
          <p className="text-sm text-blue-700">
            {userType === 'admin' 
              ? 'Enter a new password for this admin user. Password must be at least 6 characters long.'
              : 'Set a new passcode for this team member. You can generate a random passcode or enter a custom one.'
            }
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New {userType === 'admin' ? 'Password' : 'Passcode'}
          </label>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Enter new ${userType === 'admin' ? 'password' : 'passcode'}`}
                minLength={userType === 'admin' ? 6 : 4}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            {userType === 'team' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateNewPasscode}
              >
                Generate
              </Button>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Reset {userType === 'admin' ? 'Password' : 'Passcode'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}