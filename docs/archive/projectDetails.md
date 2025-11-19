# Solar Analytics Dashboard - Complete Project Documentation

> **📦 Archive Notice:** This document contains legacy project details. For current documentation, see the main [README.md](../../README.md) and [Documentation Hub](../README.md).

**Status:** 📦 Archived - Historical Reference  
**Maintainer:** Anuja Jayasinghe

## 📋 Project Overview

**Solar Analytics Dashboard** is a modern React-based web application designed for monitoring and analyzing solar energy generation data. The application provides comprehensive analytics for both CEB (Ceylon Electricity Board) export data and inverter generation data, with advanced admin management capabilities.

## 🏗️ Project Architecture

### Technology Stack

#### Frontend Framework & Build Tools
- **React 19.1.1** - Modern React with latest features
- **Vite 7.1.7** - Fast build tool and development server
- **React Router DOM 7.9.1** - Client-side routing
- **JavaScript (ES6+)** - Modern JavaScript with modules

#### Data Visualization
- **Recharts 3.2.1** - React charting library for data visualization
- **Chart.js 4.5.0** - Additional charting capabilities

#### Backend & Database
- **Supabase 2.58.0** - Backend-as-a-Service (BaaS) platform
- **PostgreSQL** - Database (via Supabase)
- **Real-time subscriptions** - Live data updates

#### Development Tools
- **ESLint 9.36.0** - Code linting and quality assurance
- **TypeScript types** - Type definitions for React and React DOM
- **Vite React Plugin** - Optimized React development

## 📁 Project Structure

```
Solar-Analytics-Dashboard/
├── public/                          # Static assets
│   ├── 1.png, 1.svg               # Solar panel images
│   ├── 2.png, 2.svg               # Dashboard icons
│   ├── 3.png, 3.svg               # Analytics icons
│   ├── SolarEdge.zip              # SolarEdge data files
│   └── vite.svg                   # Vite logo
├── src/
│   ├── components/                 # Reusable React components
│   │   ├── ThemeContext.jsx       # Dark/Light theme management
│   │   ├── Sidebar.jsx           # Navigation sidebar
│   │   ├── Navbar.jsx            # Top navigation with admin access
│   │   ├── DashboardCard.jsx     # Dashboard metric cards
│   │   └── CebDataManagement.jsx # CEB data CRUD operations
│   ├── contexts/                  # React Context providers
│   │   └── AuthContext.jsx        # Authentication state management
│   ├── lib/                       # Utility libraries
│   │   ├── supabaseClient.js      # Supabase configuration
│   │   ├── dataService.js         # Data aggregation services
│   │   └── verifySupabaseConnection.js # Connection testing
│   ├── pages/                     # Application pages
│   │   ├── Dashboard.jsx          # Main analytics dashboard
│   │   ├── Settings.jsx          # System settings management
│   │   ├── AdminLogin.jsx         # Admin authentication
│   │   ├── AdminDashboard.jsx    # Admin management interface
│   │   └── login.jsx             # Alternative login page
│   ├── App.jsx                    # Main application component
│   ├── App.css                    # Application styles
│   ├── index.css                  # Global styles with theme support
│   └── main.jsx                   # Application entry point
├── package.json                   # Dependencies and scripts
├── vite.config.js                 # Vite configuration
├── eslint.config.js              # ESLint configuration
└── index.html                    # HTML entry point
```

## 🔧 Core Components Analysis

### 1. Application Entry Point (`main.jsx`)
- **Purpose**: Initializes React application
- **Functionality**: Renders App component to DOM root
- **Dependencies**: React, ReactDOM

### 2. Main App Component (`App.jsx`)
- **Purpose**: Application root with routing and context providers
- **Key Features**:
  - **Theme Provider**: Manages dark/light theme switching
  - **Auth Provider**: Handles authentication state
  - **Router Setup**: Defines application routes
  - **Admin Protection**: Route guards for admin-only areas
  - **Supabase Connection**: Verifies database connectivity

**Route Structure**:
```
/ (root) → Dashboard (with sidebar/navbar)
/dashboard → Dashboard (with sidebar/navbar)
/settings → Settings (with sidebar/navbar)
/admin → AdminLogin (standalone)
/admin/dashboard → AdminDashboard (standalone, admin-only)
```

### 3. Authentication System (`AuthContext.jsx`)

**Advanced Features**:
- **Google OAuth Integration**: Seamless Google sign-in
- **Admin Role Management**: Database-driven admin verification
- **Session Persistence**: Maintains login state
- **Connection Resilience**: Retry logic for database connectivity
- **Caching System**: Reduces database calls for admin status
- **Tab Visibility Handling**: Refreshes auth state on tab focus

**Admin Verification Process**:
1. Checks `admin_users` table for user email
2. Implements retry logic with exponential backoff
3. Caches results for 5 minutes to reduce database load
4. Falls back to cached results on connection errors

### 4. Theme Management (`ThemeContext.jsx`)

**Features**:
- **Persistent Storage**: Saves theme preference in localStorage
- **Dynamic CSS Variables**: Updates CSS custom properties
- **Body Class Management**: Applies theme classes to document body
- **Context API**: Provides theme state throughout application

## 📊 Data Management System

### 1. Supabase Integration (`supabaseClient.js`)
- **Configuration**: Environment-based Supabase URL and keys
- **Client Creation**: Initializes Supabase client for database operations
- **Environment Variables**:
  - `VITE_SUPABASE_URL`: Supabase project URL
  - `VITE_SUPABASE_ANON_KEY`: Public anonymous key

### 2. Data Service (`dataService.js`)

**Core Functions**:
- **`getMonthlyData()`**: Aggregates monthly solar generation data
- **`getYearlyData()`**: Aggregates yearly solar generation data
- **Data Sources**: 
  - `ceb_data` table: CEB export readings and earnings
  - `inverter_data` table: Inverter generation data(table sketh only not implemented the funtions yet)

**Data Aggregation Logic**:
- **Monthly Aggregation**: Groups data by month-year
- **Yearly Aggregation**: Groups data by year
- **Earnings Calculation**: Uses stored earnings or calculates from rate
- **Data Sorting**: Chronological ordering for accurate trends

### 3. Connection Verification (`verifySupabaseConnection.js`)
- **Purpose**: Tests Supabase connectivity on app startup
- **Error Handling**: Provides detailed connection status
- **Environment Validation**: Checks for required environment variables

## 🎨 User Interface Components

### 1. Navigation System

**Sidebar (`Sidebar.jsx`)**:
- **Branding**: SolarDash logo with lightning emoji
- **Navigation Links**: Dashboard and Settings
- **Styling**: Theme-aware with CSS variables

**Navbar (`Navbar.jsx`)**:
- **Title**: Solar Dashboard with branding
- **Admin Access**: Interactive admin access button
- **Fun Popup**: Entertaining admin access restriction message
- **Theme Integration**: Uses theme context for styling

### 2. Dashboard Components

**Dashboard (`Dashboard.jsx`)**:
- **Data Visualization**: Bar charts and line charts using Recharts
- **Metric Cards**: Key performance indicators
- **View Toggle**: Monthly vs yearly data views
- **Real-time Updates**: Automatic data refresh
- **Error Handling**: User-friendly error messages

**Key Metrics Displayed**:
- CEB Units exported
- CEB Earnings (LKR)
- Inverter Generation (kWh)
- Estimated Earnings (LKR)

### 3. Settings Management (`Settings.jsx`)

**Features**:
- **Dynamic Settings**: Fetches settings from database
- **Theme Control**: Dark/light theme switching
- **Rate Configuration**: kWh rate for calculations
- **Default Settings**: Auto-creates initial settings
- **Real-time Updates**: Immediate theme changes

**Settings Types**:
- `theme`: Application theme (dark/light)
- `rate_per_kwh`: Default rate for earnings calculations

## 🔐 Admin System

### 1. Admin Authentication (`AdminLogin.jsx`)

**Authentication Methods**:
- **Google OAuth**: Primary authentication method
- **Session Management**: Automatic redirect for authenticated admins
- **Error Handling**: Clear feedback for unauthorized users
- **Account Switching**: Easy logout and re-authentication

### 2. Admin Dashboard (`AdminDashboard.jsx`)

**Tab-based Interface**:
- **CEB Data Management**: Full CRUD operations for CEB data
- **Inverter Data Management**: Placeholder for future inverter data
- **Admin Management**: Placeholder for user management

**Navigation Features**:
- **Tab System**: Organized data management sections
- **Return to Dashboard**: Easy navigation back to main app
- **Responsive Design**: Mobile-friendly interface

### 3. CEB Data Management (`CebDataManagement.jsx`)

**CRUD Operations**:
- **Create**: Add new CEB export records
- **Read**: Display all CEB data in table format
- **Update**: Edit existing records
- **Delete**: Remove records with confirmation

**Data Fields**:
- `bill_date`: Date of the CEB bill
- `meter_reading`: Meter reading value
- `units_exported`: Units exported to grid
- `earnings`: Earnings from CEB (LKR)

**Advanced Features**:
- **Form Validation**: Required field validation
- **Confirmation Dialogs**: Safe deletion with confirmation
- **Real-time Updates**: Immediate data refresh after operations
- **Error Handling**: Comprehensive error messages
- **Rate Integration**: Shows current tariff rate

## 🎨 Styling System

### 1. CSS Architecture (`index.css`)

**CSS Custom Properties**:
```css
:root {
  --accent: #ff7a00;           /* Primary orange color */
  --accent-secondary: #00c2a8; /* Secondary teal color */
  --error-color: #ff4444;      /* Error red color */
  --bg-color: #0d0d0d;         /* Background color */
  --text-color: #ffffff;       /* Text color */
  --sidebar-bg: #1a1a1a;      /* Sidebar background */
  --navbar-bg: #111;           /* Navbar background */
  --border-color: #444;        /* Border color */
  --hover-bg: #333;           /* Hover background */
}
```

**Theme Support**:
- **Dark Theme**: Default dark theme with high contrast
- **Light Theme**: Light theme with appropriate color adjustments
- **Smooth Transitions**: 0.3s transitions for theme changes
- **Responsive Design**: Mobile-first approach

### 2. Component Styling

**Design Patterns**:
- **Glass Morphism**: Backdrop blur effects
- **Gradient Buttons**: Eye-catching call-to-action buttons
- **Card-based Layout**: Organized content in cards
- **Consistent Spacing**: Uniform padding and margins
- **Interactive Elements**: Hover effects and animations

## 📈 Data Flow Architecture

### 1. Data Sources
- **CEB Data**: Monthly export readings from electricity board
- **Inverter Data**: Solar panel generation data
- **System Settings**: Application configuration
- **Admin Users**: Authorized admin accounts

### 2. Data Processing Pipeline
1. **Data Fetching**: Supabase queries for raw data
2. **Aggregation**: Monthly/yearly data grouping
3. **Calculation**: Earnings and performance metrics
4. **Visualization**: Chart rendering with Recharts
5. **Real-time Updates**: Automatic data refresh

### 3. State Management
- **React Context**: Global state for theme and authentication
- **Local State**: Component-level state management
- **Supabase State**: Real-time database synchronization
- **Session Persistence**: Maintains user sessions

## 🔧 Development & Build Process

### 1. Development Scripts
```json
{
  "dev": "vite",           // Development server
  "build": "vite build",   // Production build
  "lint": "eslint .",      // Code linting
  "preview": "vite preview" // Preview production build
}
```

### 2. Build Configuration (`vite.config.js`)
- **React Plugin**: Optimized React development
- **Hot Module Replacement**: Fast development updates
- **Asset Optimization**: Automatic asset processing

### 3. Code Quality (`eslint.config.js`)
- **ESLint Rules**: Code quality enforcement
- **React Hooks**: React-specific linting rules
- **Browser Globals**: Browser environment support
- **Custom Rules**: Project-specific linting rules

## 🚀 Deployment & Environment

### 1. Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SCHEMA=public
VITE_SUPABASE_TABLE_CEB=ceb_data
VITE_SUPABASE_TABLE_INVERTER=inverter_data
```

### 2. Production Build
- **Vite Build**: Optimized production bundle
- **Asset Hashing**: Cache-busting for assets
- **Code Splitting**: Optimized loading
- **Minification**: Compressed JavaScript and CSS

## 🔍 Key Features & Capabilities

### 1. Analytics Dashboard
- **Multi-source Data**: CEB and inverter data comparison
- **Visual Charts**: Bar charts and line charts
- **Time Periods**: Monthly and yearly views
- **Performance Metrics**: Key performance indicators
- **Trend Analysis**: Historical data trends

### 2. Data Management
- **CRUD Operations**: Complete data lifecycle management
- **Data Validation**: Input validation and error handling
- **Bulk Operations**: Efficient data processing
- **Data Export**: Future capability for data export

### 3. User Experience
- **Responsive Design**: Mobile and desktop optimized
- **Theme Support**: Dark and light themes
- **Intuitive Navigation**: Easy-to-use interface
- **Real-time Updates**: Live data synchronization
- **Error Handling**: User-friendly error messages

### 4. Security & Access Control
- **Admin Authentication**: Secure admin access
- **Role-based Access**: Admin-only features
- **Session Management**: Secure session handling
- **Data Validation**: Input sanitization

## 🎯 Future Enhancements

### 1. Planned Features
- **Inverter Data Management**: Complete inverter data CRUD
- **Admin User Management**: Admin account management
- **Data Export**: CSV/Excel export functionality
- **Advanced Analytics**: More detailed analytics
- **Mobile App**: React Native mobile application

### 2. Technical Improvements
- **Performance Optimization**: Code splitting and lazy loading
- **Testing**: Unit and integration tests
- **Documentation**: API documentation
- **Monitoring**: Application performance monitoring

## 📋 Database Schema

### 1. Core Tables
- **`ceb_data`**: CEB export readings and earnings
- **`inverter_data`**: Solar inverter generation data
- **`system_settings`**: Application configuration
- **`admin_users`**: Authorized admin accounts

### 2. Data Relationships
- **Independent Tables**: Each data source is independent
- **Settings Integration**: Settings affect calculations
- **Admin Verification**: Admin table controls access

## 🎨 Design Philosophy

### 1. User Experience
- **Simplicity**: Clean, intuitive interface
- **Accessibility**: High contrast and readable fonts
- **Performance**: Fast loading and responsive
- **Consistency**: Uniform design patterns

### 2. Developer Experience
- **Modular Architecture**: Reusable components
- **Clear Separation**: Distinct concerns separated
- **Documentation**: Well-documented code
- **Maintainability**: Easy to extend and modify

## 🔧 Technical Specifications

### 1. Performance
- **Bundle Size**: Optimized for fast loading
- **Lazy Loading**: Components loaded on demand
- **Caching**: Efficient data caching strategies
- **Real-time**: Live data updates

### 2. Scalability
- **Component-based**: Modular architecture
- **State Management**: Efficient state handling

---

## 📋 Document History

**Maintainer:** Anuja Jayasinghe  

### Change Log
- **Created:** Pre-v2.0.0 - Comprehensive legacy project documentation
- **Updated:** November 19, 2025 - Added archive notice and maintainer log

**Status:** 📦 Archived - Historical reference for project structure  
**Last Updated:** November 19, 2025
- **Database**: Scalable Supabase backend
- **API Design**: RESTful data access

This comprehensive documentation provides a complete understanding of the Solar Analytics Dashboard project, its architecture, features, and implementation details. The application represents a modern, well-structured React application with advanced data visualization, authentication, and admin management capabilities.
