import streamlit as st
import pandas as pd
import plotly.express as px
from snowflake.snowpark import Session
import os

st.set_page_config(
    page_title="Workspace Details",
    page_icon="🏢",
    layout="wide"
)

st.title("🏢 Workspace Details")

@st.cache_resource
def get_snowflake_session():
    # Prefer Streamlit secrets (prod) but gracefully fall back to env vars (dev/CI)
    if "snowflake" in st.secrets:
        connection_parameters = dict(st.secrets["snowflake"])
    else:
        connection_parameters = {
            "account": os.getenv("SNOWFLAKE_ACCOUNT"),
            "user": os.getenv("SNOWFLAKE_USER"),
            "password": os.getenv("SNOWFLAKE_PASSWORD"),
            "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
            "database": os.getenv("SNOWFLAKE_DATABASE", "SNOWFLAKE"),
            "schema": os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC"),
        }
        # Optional token / authenticator handling (aligns with TS collector)
        if os.getenv("SNOWFLAKE_TOKEN"):
            connection_parameters["token"] = os.getenv("SNOWFLAKE_TOKEN")
            connection_parameters["authenticator"] = "OAUTH"
        elif os.getenv("SNOWFLAKE_AUTHENTICATOR"):
            connection_parameters["authenticator"] = os.getenv("SNOWFLAKE_AUTHENTICATOR")

    return Session.builder.configs(connection_parameters).create()

session = get_snowflake_session()

@st.cache_data(ttl=300)
def get_workspace_metrics():
    query = """
    SELECT
        workspace_id,
        COUNT(*) as total_runs,
        AVG(duration_seconds)/60 as avg_duration_minutes,
        MIN(created_at) as first_run,
        MAX(created_at) as last_run,
        COUNT(DISTINCT DATE(created_at)) as active_days
    FROM eval_runs
    WHERE created_at >= DATEADD(month, -3, CURRENT_DATE())
    GROUP BY workspace_id
    ORDER BY total_runs DESC
    """
    return session.sql(query).to_pandas()

try:
    workspace_data = get_workspace_metrics()

    if not workspace_data.empty:
        st.subheader("📊 Top Workspaces by Activity")

        # Top workspaces bar chart
        top_10 = workspace_data.head(10)
        fig_top = px.bar(
            top_10,
            x='WORKSPACE_ID',
            y='TOTAL_RUNS',
            title="Top 10 Workspaces by Evaluation Runs (Last 3 Months)",
            color='TOTAL_RUNS',
            color_continuous_scale='Blues'
        )
        fig_top.update_layout(
            xaxis_title="Workspace ID",
            yaxis_title="Total Evaluation Runs",
            xaxis_tickangle=45
        )
        st.plotly_chart(fig_top, use_container_width=True)

        # Metrics distribution
        col1, col2 = st.columns(2)

        with col1:
            st.write("**Average Duration Distribution**")
            fig_duration = px.histogram(
                workspace_data,
                x='AVG_DURATION_MINUTES',
                nbins=20,
                title="Distribution of Average Evaluation Duration",
                color_discrete_sequence=['#FF6B6B']
            )
            fig_duration.update_layout(
                xaxis_title="Average Duration (Minutes)",
                yaxis_title="Number of Workspaces"
            )
            st.plotly_chart(fig_duration, use_container_width=True)

        with col2:
            st.write("**Activity Level Distribution**")
            fig_active = px.histogram(
                workspace_data,
                x='ACTIVE_DAYS',
                nbins=15,
                title="Distribution of Active Days",
                color_discrete_sequence=['#4ECDC4']
            )
            fig_active.update_layout(
                xaxis_title="Active Days",
                yaxis_title="Number of Workspaces"
            )
            st.plotly_chart(fig_active, use_container_width=True)

        # Detailed workspace table
        st.subheader("📋 Workspace Details Table")

        # Format the data for display
        display_data = workspace_data.copy()
        display_data['AVG_DURATION_MINUTES'] = display_data['AVG_DURATION_MINUTES'].round(2)
        display_data['FIRST_RUN'] = pd.to_datetime(display_data['FIRST_RUN']).dt.strftime('%Y-%m-%d')
        display_data['LAST_RUN'] = pd.to_datetime(display_data['LAST_RUN']).dt.strftime('%Y-%m-%d')

        # Add search functionality
        search_term = st.text_input("Search workspace ID:")
        if search_term:
            display_data = display_data[display_data['WORKSPACE_ID'].str.contains(search_term, case=False)]

        st.dataframe(
            display_data,
            column_config={
                "WORKSPACE_ID": "Workspace ID",
                "TOTAL_RUNS": "Total Runs",
                "AVG_DURATION_MINUTES": "Avg Duration (min)",
                "FIRST_RUN": "First Run",
                "LAST_RUN": "Last Run",
                "ACTIVE_DAYS": "Active Days"
            },
            use_container_width=True
        )

        # Summary stats
        st.subheader("📈 Summary Statistics")
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric("Total Workspaces", len(workspace_data))

        with col2:
            st.metric("Most Active Workspace", f"{workspace_data.iloc[0]['TOTAL_RUNS']:.0f} runs")

        with col3:
            avg_runs = workspace_data['TOTAL_RUNS'].mean()
            st.metric("Average Runs per Workspace", f"{avg_runs:.1f}")

        with col4:
            avg_duration = workspace_data['AVG_DURATION_MINUTES'].mean()
            st.metric("Overall Avg Duration", f"{avg_duration:.1f} min")

except Exception as e:
    st.error(f"Error loading workspace data: {str(e)}")
    st.info("Please check your Snowflake configuration and data availability.")
