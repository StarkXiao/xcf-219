import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  FileTextOutlined,
  FormOutlined,
  PaperClipOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ExceptionOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import Guidelines from './pages/Guidelines';
import DeclarationForm from './pages/DeclarationForm';
import DeclarationList from './pages/DeclarationList';
import DeclarationDetail from './pages/DeclarationDetail';
import AttachmentDemo from './pages/AttachmentDemo';
import WorkflowDemo from './pages/WorkflowDemo';
import Approval from './pages/Approval';
import Logs from './pages/Logs';
import Dashboard from './pages/Dashboard';

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '系统概览',
  },
  {
    key: '/guidelines',
    icon: <FileTextOutlined />,
    label: '申报指南',
  },
  {
    key: '/declarations',
    icon: <FormOutlined />,
    label: '申报管理',
  },
  {
    key: '/attachments',
    icon: <PaperClipOutlined />,
    label: '附件上传演示',
  },
  {
    key: '/workflow',
    icon: <SwapOutlined />,
    label: '状态流转演示',
  },
  {
    key: '/approval',
    icon: <CheckCircleOutlined />,
    label: '后台审批',
  },
  {
    key: '/logs',
    icon: <ExceptionOutlined />,
    label: '操作日志',
  },
];

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/declarations/') && path.includes('/edit')) {
      return '/declarations';
    }
    if (path.startsWith('/declarations/')) {
      return '/declarations';
    }
    return path;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529' }}>
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', marginRight: '48px' }}>
          企业项目申报管理系统
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '16px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/guidelines" element={<Guidelines />} />
              <Route path="/declarations" element={<DeclarationList />} />
              <Route path="/declarations/new" element={<DeclarationForm />} />
              <Route path="/declarations/:id/edit" element={<DeclarationForm />} />
              <Route path="/declarations/:id" element={<DeclarationDetail />} />
              <Route path="/attachments" element={<AttachmentDemo />} />
              <Route path="/workflow" element={<WorkflowDemo />} />
              <Route path="/approval" element={<Approval />} />
              <Route path="/logs" element={<Logs />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
